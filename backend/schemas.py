from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PlayerBase(BaseModel):
    name: str
    school_name: str
    team_number: int
    team_name: str
    contact: Optional[str] = None
    notes: Optional[str] = None

class PlayerCreate(PlayerBase):
    pass

class Player(PlayerBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class MatchBase(BaseModel):
    player_id: int

class MatchCreate(MatchBase):
    pass

class Match(MatchBase):
    id: int
    score: int
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    player: Player
    class Config:
        from_attributes = True
