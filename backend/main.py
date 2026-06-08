from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict
from datetime import datetime, timezone
import json
import asyncio

import models, schemas, database
from sqlalchemy import text

models.Base.metadata.create_all(bind=database.engine)

try:
    with database.engine.connect() as conn:
        conn.execute(text("ALTER TABLE matches ADD COLUMN duration INTEGER DEFAULT 30;"))
        conn.commit()
except Exception:
    pass  # Column already exists or another error occurred

app = FastAPI(title="FTC Mini-Game API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "https://ftc-minigame-123.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

async def auto_end_match(match_id: int, duration: int):
    await asyncio.sleep(duration)
    db = database.SessionLocal()
    try:
        active_match = db.query(models.Match).filter(models.Match.id == match_id, models.Match.status == "active").first()
        if active_match:
            active_match.status = "completed"
            active_match.end_time = datetime.now(timezone.utc)
            db.commit()
            db.refresh(active_match)
            
            await manager.broadcast({
                "type": "GAME_STATE",
                "state": "completed",
                "match_id": active_match.id,
                "final_score": active_match.score
            })
    finally:
        db.close()

# --- API ENDPOINTS ---

@app.post("/players/", response_model=schemas.Player)
def create_player(player: schemas.PlayerCreate, db: Session = Depends(database.get_db)):
    db_player = models.Player(**player.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player

@app.get("/players/", response_model=List[schemas.Player])
def read_players(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    players = db.query(models.Player).order_by(desc(models.Player.created_at)).offset(skip).limit(limit).all()
    return players

@app.post("/matches/start", response_model=schemas.Match)
async def start_match(match: schemas.MatchCreate, db: Session = Depends(database.get_db)):
    # Cancel any active matches
    active_matches = db.query(models.Match).filter(models.Match.status == "active").all()
    for m in active_matches:
        m.status = "completed"
        m.end_time = datetime.now(timezone.utc)
    
    db_match = models.Match(player_id=match.player_id, status="active", start_time=datetime.now(timezone.utc), score=0, duration=match.duration)
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    
    # Broadcast game start
    await manager.broadcast({
        "type": "GAME_STATE",
        "state": "active",
        "match_id": db_match.id,
        "score": 0,
        "duration": db_match.duration,
        "player_name": db_match.player.name,
        "team_name": db_match.player.team_name,
        "team_number": db_match.player.team_number
    })
    
    asyncio.create_task(auto_end_match(db_match.id, db_match.duration))
    
    return db_match

@app.post("/matches/end")
async def end_match(db: Session = Depends(database.get_db)):
    active_match = db.query(models.Match).filter(models.Match.status == "active").first()
    if active_match:
        active_match.status = "completed"
        active_match.end_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(active_match)
        
        await manager.broadcast({
            "type": "GAME_STATE",
            "state": "completed",
            "match_id": active_match.id,
            "final_score": active_match.score
        })
        return active_match
    raise HTTPException(status_code=400, detail="No active match")

@app.post("/hardware/score")
async def hardware_score(db: Session = Depends(database.get_db)):
    """ Endpoint for ESP32 to ping when a score happens (if not using WebSockets directly) """
    active_match = db.query(models.Match).filter(models.Match.status == "active").first()
    if active_match:
        active_match.score += 1
        db.commit()
        db.refresh(active_match)
        
        await manager.broadcast({
            "type": "SCORE_UPDATE",
            "score": active_match.score
        })
        return {"status": "ok", "score": active_match.score}
    return {"status": "ignored", "reason": "No active match"}

@app.get("/leaderboard")
def get_leaderboard(db: Session = Depends(database.get_db)):
    # Group by player, get max score
    from sqlalchemy import func
    
    subquery = db.query(
        models.Match.player_id,
        func.max(models.Match.score).label("max_score")
    ).filter(models.Match.status == "completed").group_by(models.Match.player_id).subquery()
    
    leaderboard = db.query(
        models.Player.name,
        models.Player.team_name,
        models.Player.team_number,
        subquery.c.max_score
    ).join(subquery, models.Player.id == subquery.c.player_id).order_by(desc(subquery.c.max_score)).limit(10).all()
    
    return [{"name": l.name, "team_name": l.team_name, "team_number": l.team_number, "score": l.max_score} for l in leaderboard]

@app.get("/state")
def get_current_state(db: Session = Depends(database.get_db)):
    active_match = db.query(models.Match).filter(models.Match.status == "active").first()
    if active_match:
        return {
            "state": "active",
            "match_id": active_match.id,
            "score": active_match.score,
            "duration": active_match.duration,
            "player_name": active_match.player.name,
            "team_name": active_match.player.team_name,
            "team_number": active_match.player.team_number
        }
    return {"state": "idle"}

@app.delete("/matches/")
def delete_all_matches(db: Session = Depends(database.get_db)):
    db.query(models.Match).delete()
    db.commit()
    return {"status": "ok"}

@app.delete("/players/")
def delete_all_players(db: Session = Depends(database.get_db)):
    # Delete matches first due to foreign key constraints
    db.query(models.Match).delete()
    db.query(models.Player).delete()
    db.commit()
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # wait for messages if any
            data = await websocket.receive_text()
            # If ESP32 connects via WS, it could send scores here
            if data == "SCORE":
                db = database.SessionLocal()
                try:
                    active_match = db.query(models.Match).filter(models.Match.status == "active").first()
                    if active_match:
                        active_match.score += 1
                        db.commit()
                        db.refresh(active_match)
                        await manager.broadcast({
                            "type": "SCORE_UPDATE",
                            "score": active_match.score
                        })
                finally:
                    db.close()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
