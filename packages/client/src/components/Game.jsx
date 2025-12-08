import { useNavigate } from 'react-router-dom';
import './Game.css';

function Game({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="game-container">
      <header className="game-header">
        <h1>Bonk Chess</h1>
        <div className="user-info">
          <span>Welcome, {user}!</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="game-main">
        <div className="game-content">
          <h2>Ready to Play!</h2>
          <p>Your chess game will appear here.</p>
          <button className="find-game-btn">Find Game</button>
        </div>
      </main>

      <footer className="game-footer">
        <p>Bonk Chess - Multiplayer Chess Game</p>
      </footer>
    </div>
  );
}

export default Game;