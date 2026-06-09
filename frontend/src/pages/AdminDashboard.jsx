import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Play, Square, RefreshCcw, Activity, Lock, Trash2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:8000`;

function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [players, setPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameState, setGameState] = useState({ state: 'idle' });
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };
  const [newPlayer, setNewPlayer] = useState({
    name: '', school_name: '', team_number: '', team_name: '', contact: '', notes: ''
  });
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);

  const fetchPlayers = () => {
    axios.get(`${BACKEND_URL}/players/`).then(res => setPlayers(res.data)).catch(console.error);
  };

  const fetchLeaderboard = () => {
    axios.get(`${BACKEND_URL}/leaderboard`).then(res => setLeaderboard(res.data)).catch(console.error);
  };

  const fetchState = () => {
    axios.get(`${BACKEND_URL}/state`).then(res => setGameState(res.data)).catch(console.error);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlayers();
      fetchLeaderboard();
      fetchState();
      const interval = setInterval(() => {
        fetchState();
        fetchLeaderboard();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'password123') {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect password');
      setPassword('');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    axios.post(`${BACKEND_URL}/players/`, {
      ...newPlayer,
      team_number: parseInt(newPlayer.team_number)
    }).then(() => {
      fetchPlayers();
      setNewPlayer({ name: '', school_name: '', team_number: '', team_name: '', contact: '', notes: '' });
      showToast("Player registered!");
    }).catch(console.error);
  };

  const handleDeletePlayer = (playerId) => {
    if (window.confirm("Are you sure you want to delete this player and all their matches?")) {
      axios.delete(`${BACKEND_URL}/players/${playerId}`)
        .then(() => {
          fetchPlayers();
          fetchLeaderboard();
          fetchState();
          if (selectedPlayer == playerId) setSelectedPlayer('');
        })
        .catch(console.error);
    }
  };

  const handleDeleteLeaderboardEntry = (playerId) => {
    if (window.confirm("Are you sure you want to delete all matches for this player from the leaderboard?")) {
      axios.delete(`${BACKEND_URL}/leaderboard/${playerId}`)
        .then(() => {
          fetchLeaderboard();
          fetchState();
        })
        .catch(console.error);
    }
  };

  const handleStartMatch = () => {
    if (!selectedPlayer) return alert("Select a player first");
    axios.post(`${BACKEND_URL}/matches/start`, { 
      player_id: parseInt(selectedPlayer),
      duration: parseInt(selectedDuration)
    })
      .then(fetchState)
      .catch(console.error);
  };

  const handleEndMatch = () => {
    axios.post(`${BACKEND_URL}/matches/end`)
      .then(fetchState)
      .catch(console.error);
  };

  const handleClearLeaderboard = () => {
    if (window.confirm("Are you sure you want to delete all matches? This will wipe the leaderboard entirely.")) {
      axios.delete(`${BACKEND_URL}/matches/`)
        .then(() => {
          showToast("Leaderboard cleared.");
          fetchState();
          fetchLeaderboard();
        })
        .catch(console.error);
    }
  };

  const handleClearPlayers = () => {
    if (window.confirm("Are you sure you want to delete ALL players and matches? This is irreversible.")) {
      axios.delete(`${BACKEND_URL}/players/`)
        .then(() => {
          showToast("All players and matches deleted.");
          fetchPlayers();
          fetchState();
          fetchLeaderboard();
          setSelectedPlayer('');
        })
        .catch(console.error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="glass-panel flex flex-col items-center gap-6 animate-slide-up" style={{maxWidth: '400px', width: '100%', padding: '3rem 2rem'}}>
          <Lock size={48} color="var(--accent-red)" />
          <h2>Admin Login</h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
            <input 
              type="password" 
              placeholder="Enter Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              autoFocus 
              required 
            />
            <button type="submit" className="btn btn-primary w-full">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--success)', color: 'white', padding: '12px 24px',
          borderRadius: '8px', zIndex: 9999, fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease'
        }}>
          {toastMessage}
        </div>
      )}
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

          <div className="flex flex-col gap-2">
            <label>Match Duration</label>
            <select value={selectedDuration} onChange={e => setSelectedDuration(e.target.value)}>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="90">1 min 30 seconds</option>
              <option value="120">2 minutes</option>
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

        {/* Player Registration and List */}
        <div className="flex flex-col gap-6">
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

          {/* Registered Players List */}
          <div className="glass-panel" style={{ overflowY: 'auto', maxHeight: '400px' }}>
            <h3>Registered Players</h3>
            {players.length === 0 ? (
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No players registered yet.</p>
            ) : (
              <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Name</th>
                    <th style={{ padding: '0.5rem' }}>Team</th>
                    <th style={{ padding: '0.5rem' }}>School</th>
                    <th style={{ padding: '0.5rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem' }}>{p.name}</td>
                      <td style={{ padding: '0.5rem' }}>{p.team_number} ({p.team_name})</td>
                      <td style={{ padding: '0.5rem' }}>{p.school_name}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <button className="btn btn-danger" style={{padding: '0.3rem 0.5rem', minWidth: 'auto'}} onClick={() => handleDeletePlayer(p.id)} title="Delete Player">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Admin Leaderboard View */}
          <div className="glass-panel" style={{ overflowY: 'auto', maxHeight: '400px' }}>
            <h3>Current Leaderboard</h3>
            {leaderboard.length === 0 ? (
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No scores on the leaderboard.</p>
            ) : (
              <table style={{ width: '100%', marginTop: '1rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Rank</th>
                    <th style={{ padding: '0.5rem' }}>Player</th>
                    <th style={{ padding: '0.5rem' }}>Score</th>
                    <th style={{ padding: '0.5rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem' }}>#{index + 1}</td>
                      <td style={{ padding: '0.5rem' }}>{entry.name} <br/><span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>Team {entry.team_number}</span></td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{entry.score}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <button className="btn btn-danger" style={{padding: '0.3rem 0.5rem', minWidth: 'auto'}} onClick={() => handleDeleteLeaderboardEntry(entry.player_id)} title="Remove from Leaderboard">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-panel" style={{ marginTop: '2rem', border: '2px solid var(--accent-red)' }}>
        <h3 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>Danger Zone</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>These actions are destructive and cannot be undone.</p>
        <div className="flex gap-4">
          <button className="btn btn-danger" onClick={handleClearLeaderboard}>Clear Leaderboard (Delete all matches)</button>
          <button className="btn btn-danger" onClick={handleClearPlayers}>Delete All Players & Registrations</button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
