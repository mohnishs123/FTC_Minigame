import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, Clock, User, Activity } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`;
const WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws';

function PublicDisplay() {
  const [gameState, setGameState] = useState({ state: 'idle', score: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState(30);

  const fetchStateAndLeaderboard = () => {
    axios.get(`${BACKEND_URL}/state`).then(res => {
      setGameState(prev => {
        // Only update if the backend says active, OR if backend says idle but we are not in 'completed' state
        // We don't want to overwrite the 'completed' screen immediately.
        if (res.data.state === 'active') {
          // If we were already active, just update score so we don't reset timer
          if (prev.state === 'active' && prev.player_name === res.data.player_name) {
             return { ...prev, score: res.data.score };
          }
          // New match
          setTimeLeft(30);
          return res.data;
        } else if (res.data.state === 'idle' && prev.state !== 'completed') {
          return res.data;
        }
        return prev;
      });
    }).catch(console.error);

    axios.get(`${BACKEND_URL}/leaderboard`).then(res => {
      setLeaderboard(res.data);
    }).catch(console.error);
  };

  useEffect(() => {
    fetchStateAndLeaderboard();
    const interval = setInterval(fetchStateAndLeaderboard, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let ws;
    let reconnectTimer;
    
    const connectWs = () => {
      ws = new WebSocket(WS_URL);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'GAME_STATE') {
          if (data.state === 'active') {
            setGameState({
              state: 'active',
              score: data.score,
              player_name: data.player_name,
              team_name: data.team_name,
              team_number: data.team_number
            });
            setTimeLeft(30);
          } else if (data.state === 'completed') {
            setGameState({ state: 'completed', score: data.final_score });
            // Refresh leaderboard
            axios.get(`${BACKEND_URL}/leaderboard`).then(res => setLeaderboard(res.data)).catch(console.error);
            
            // Go back to idle after 10 seconds
            setTimeout(() => {
              setGameState({ state: 'idle', score: 0 });
            }, 10000);
          }
        } else if (data.type === 'SCORE_UPDATE') {
          setGameState(prev => ({ ...prev, score: data.score }));
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        reconnectTimer = setTimeout(connectWs, 2000);
      };
      
      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        ws.close();
      };
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    let timer;
    if (gameState.state === 'active' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && gameState.state === 'active') {
      // Time is up, but we wait for backend to send 'completed'
    }
    return () => clearInterval(timer);
  }, [gameState.state, timeLeft]);

  return (
    <div className="app-container">
      <header className="nav-bar glass-panel animate-slide-up" style={{marginBottom: '2rem'}}>
        <div className="flex items-center gap-4">
          <Activity color="var(--accent-blue)" size={32} />
          <h2>FTC Pit Mini-Game</h2>
        </div>
        <div className="flex items-center gap-2">
          <div style={{width: 10, height: 10, borderRadius: '50%', background: 'var(--success)'}}></div>
          <span style={{color: 'var(--text-muted)'}}>System Online</span>
        </div>
      </header>

      <div className="grid-2">
        {/* Live Match Panel */}
        <div className={`glass-panel flex flex-col items-center justify-center theme-${gameState.state === 'active' ? 'blue' : 'red'}`} style={{minHeight: '600px', position: 'relative', overflow: 'hidden'}}>
          
          {gameState.state === 'idle' && (
            <div className="flex flex-col items-center gap-4 animate-slide-up">
              <Clock size={64} color="var(--text-muted)" />
              <h1 style={{fontSize: '3rem'}}>Waiting for Match...</h1>
            </div>
          )}

          {gameState.state === 'active' && (
            <div className="flex flex-col items-center w-full animate-slide-up">
              <h2 style={{color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '2px'}}>Match In Progress</h2>
              
              <div className="flex justify-between w-full" style={{marginTop: '2rem'}}>
                <div className="flex flex-col items-center glass-panel" style={{flex: 1, margin: '0 10px'}}>
                  <span style={{color: 'var(--text-muted)'}}>PLAYER</span>
                  <h3 style={{fontSize: '1.5rem'}}>{gameState.player_name}</h3>
                  <span style={{color: 'var(--accent-blue)'}}>#{gameState.team_number} {gameState.team_name}</span>
                </div>
                
                <div className="flex flex-col items-center glass-panel" style={{flex: 1, margin: '0 10px'}}>
                  <span style={{color: 'var(--text-muted)'}}>TIME REMAINING</span>
                  <div className={`timer-display ${timeLeft <= 10 ? 'timer-danger' : ''}`}>
                    {timeLeft}s
                  </div>
                </div>
              </div>

              <div style={{marginTop: '4rem', textAlign: 'center'}}>
                <span style={{color: 'var(--text-muted)', fontSize: '1.2rem', letterSpacing: '4px'}}>CURRENT SCORE</span>
                <div className="score-display bump">
                  {gameState.score}
                </div>
              </div>
            </div>
          )}

          {gameState.state === 'completed' && (
            <div className="flex flex-col items-center gap-4 animate-slide-up">
              <Trophy size={64} color="var(--warning)" />
              <h1 style={{fontSize: '3rem', color: 'var(--warning)'}}>Match Complete!</h1>
              <span style={{color: 'var(--text-muted)', fontSize: '1.5rem'}}>Final Score</span>
              <div className="score-display" style={{fontSize: '6rem'}}>{gameState.score}</div>
            </div>
          )}
        </div>

        {/* Leaderboard Panel */}
        <div className="glass-panel flex flex-col">
          <div className="flex items-center gap-4" style={{marginBottom: '2rem'}}>
            <Trophy color="var(--warning)" size={32} />
            <h2 style={{fontSize: '2rem'}}>Top Performers</h2>
          </div>
          
          <div className="flex flex-col gap-4">
            {leaderboard.length === 0 ? (
              <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '2rem'}}>
                No scores yet. Be the first!
              </div>
            ) : (
              leaderboard.map((entry, index) => (
                <div key={index} className="flex justify-between items-center glass-panel" style={{padding: '16px', background: index === 0 ? 'rgba(255, 204, 0, 0.1)' : ''}}>
                  <div className="flex items-center gap-6">
                    <span style={{
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      color: index === 0 ? 'var(--warning)' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'var(--text-muted)'
                    }}>#{index + 1}</span>
                    <div className="flex flex-col">
                      <span style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{entry.name}</span>
                      <span style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{entry.team_name} ({entry.team_number})</span>
                    </div>
                  </div>
                  <div style={{fontSize: '2rem', fontWeight: '900', color: 'var(--accent-blue)'}}>
                    {entry.score}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicDisplay;
