import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Game from './components/Game';
import ChessGame from './components/ChessGame';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('bonkChessUser');
    if (savedUser) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const handleLogin = (username) => {
    setUser(username);
    localStorage.setItem('bonkChessUser', username);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('bonkChessUser');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/chess/:gameId"
          element={user ? <ChessGame user={user} /> : <Navigate to="/login" replace />}
        />

        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/game" replace /> : <Login onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/register" 
          element={
            user ? <Navigate to="/game" replace /> : <Register onLogin={handleLogin} />
          } 
        />
        <Route 
          path="/game" 
          element={
            user ? <Game user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/" 
          element={<Navigate to={user ? "/game" : "/login"} replace />} 
        />
        <Route 
          path="*" 
          element={<Navigate to={user ? "/game" : "/login"} replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;