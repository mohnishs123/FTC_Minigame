import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Play, Square, RefreshCcw, Activity } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`;

function AdminDashboard() {
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState({ state: 'idle' });
  const [newPlayer, setNewPlayer] = useState({
    name: '', school_name: '', team_number: '', team_name: '', contact: '', notes: ''
  });
  const [selectedPlayer, setSelectedPlayer] = useState('');

  const fetchPlayers = () => {
    axios.get(`${BACKEND_URL}/players/`).then(res => setPlayers(res.data)).catch(console.error);
  };

  const fetchState = () => {
    axios.get(`${BACKEND_URL}/state`).then(res => setGameState(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchPlayers();
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRegister = (e) => {
    e.preventDefault();
    axios.post(`${BACKEND_URL}/players/`, {
      ...newPlayer,
      team_number: parseInt(newPlayer.team_number)
    }).then(() => {
      fetchPlayers();
      setNewPlayer({ name: '', school_name: '', team_number: '', team_name: '', contact: '', notes: '' });
      alert("Player registered!");
    }).catch(console.error);
  };

  const handleStartMatch = () => {
    if (!selectedPlayer) return alert("Select a player first");
    axios.post(`${BACKEND_URL}/matches/start`, { player_id: parseInt(selectedPlayer) })
      .then(fetchState)
      .catch(console.error);
  };

  const handleEndMatch = () => {
    axios.post(`${BACKEND_URL}/matches/end`)
      .then(fetchState)
      .catch(console.error);
  };

  return (
    <div className="app-container">
      <header className="nav-bar glass-panel" style={{marginBottom: '2rem'}}>
        <div className="flex items-center gap-4">
          <Activity color="var(--accent-red)" size={32} />
          <h2>Admin Control Panel</h2>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="btn" target="_blank" rel="noreferrer">Open Public Display</a>
        </div>
      </header>

      <div className="grid-2">
        {/* Game Control Panel */}
        <div className="glass-panel flex flex-col gap-6">
          <h3>Game Control</h3>
          
          <div className="flex flex-col gap-2">
            <label>Select Player for Next Match</label>
            <select value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
              <option value="">-- Select Player --</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name} - Team {p.team_number} ({p.team_name})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <button className="btn btn-primary" onClick={handleStartMatch} disabled={gameState.state === 'active'}>
              <Play size={20} /> Start Match
            </button>
            <button className="btn btn-danger" onClick={handleEndMatch} disabled={gameState.state !== 'active'}>
              <Square size={20} /> End Match Early
            </button>
          </div>

          <div className="glass-panel" style={{background: 'rgba(0,0,0,0.3)'}}>
            <h4 style={{marginBottom: '1rem'}}>Current Game State</h4>
            <div className="flex justify-between items-center">
              <div>
                <div>Status: <strong style={{color: gameState.state === 'active' ? 'var(--success)' : 'var(--text-muted)'}}>{gameState.state.toUpperCase()}</strong></div>
                {gameState.state === 'active' && (
                  <div>
                    <div>Player: {gameState.player_name}</div>
                    <div>Score: {gameState.score}</div>
                  </div>
                )}
              </div>
              <button className="btn" onClick={fetchState}><RefreshCcw size={16}/></button>
            </div>
          </div>
        </div>

        {/* Player Registration */}
        <div className="glass-panel">
          <h3>Register Player</h3>
          <form onSubmit={handleRegister} className="flex flex-col gap-4" style={{marginTop: '1rem'}}>
            <input placeholder="Full Name" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} required />
            <div className="grid-2" style={{gap: '1rem'}}>
              <input placeholder="Team Number" type="number" value={newPlayer.team_number} onChange={e => setNewPlayer({...newPlayer, team_number: e.target.value})} required />
              <input placeholder="Team Name" value={newPlayer.team_name} onChange={e => setNewPlayer({...newPlayer, team_name: e.target.value})} required />
            </div>
            <input placeholder="School Name" value={newPlayer.school_name} onChange={e => setNewPlayer({...newPlayer, school_name: e.target.value})} required />
            <input placeholder="Contact Info (Optional)" value={newPlayer.contact} onChange={e => setNewPlayer({...newPlayer, contact: e.target.value})} />
            <button type="submit" className="btn btn-primary" style={{alignSelf: 'flex-start'}}><UserPlus size={20}/> Register Player</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
