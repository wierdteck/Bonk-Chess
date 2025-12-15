import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import './Game.css';

function Game({ user, onLogout }) {
  const navigate = useNavigate();
  const [selectedSide, setSelectedSide] = useState(null); // only for new game
  const [gameId, setGameId] = useState(null);
  const [availableGames, setAvailableGames] = useState([]); // Active games in lobby
  // console.log(availableGames);
  useEffect(() => {
    // Receive real-time lobby updates
    socket.on('lobby-update', (games) => setAvailableGames(games));
    // Request current lobby on mount
    socket.emit('request-lobby');

    
    return () => socket.off('lobby-update');
  }, []);

  useEffect(() => {
    socket.on("redirect-to-game", ({ gameId }) => {
      navigate(`/chess/${gameId}`);
    });

    return () => socket.off("redirect-to-game");
  }, []);
  
  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const selectSide = (side) => setSelectedSide(side);

  // Start a new game (creates a game and assigns chosen side)
  const startGame = () => {

    if (!selectedSide) {
      alert("Please select a side first!");
      return;
    }

    socket.emit(
      "createGame",
      { side: selectedSide, player: user },
      ({ gameId, color }) => {
        setGameId(gameId);
        // alert(`Game created! You are playing as ${color}. Game ID: ${gameId}`);
      }
    );
  };



  // Join an existing game (auto-assign remaining side)
  const joinGame = (id, availableSide) => {

    console.log("Joining game:", id, "as", availableSide, "for user", user);

    socket.emit("joinGame", { gameId: id, side: availableSide, username:user}, (response) => {
      if (response.error) {
        alert("Error joining game: " + response.error);
        return;
      }

      setGameId(id);
      // alert(`Joined game ${id} as ${availableSide}`);
      navigate(`/chess/${id}`);
    });
  };

  return (
    <div className="game-container">
      <header className="game-header">
        <h1 className="title">Bonk Chess</h1>
        <div className="user-info">
          <span>Welcome, {user}!</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="game-main">
        <div className="home-container">
          <div className="decorative-pieces">♛♜♝♞</div>
          <div className="decorative-pieces-left">*El Primo Chess</div>

          <h1 className="title">♛ Chess* ♛</h1>
          {/* Create New Game */}
          <div className="game-options">
            <div className="side-selection">
              <div
                className={`side-option ${selectedSide === 'white' ? 'selected' : ''}`}
                onClick={() => selectSide('white')}
              >
                <div className="piece">♔</div>
                <div className="label">Play as White</div>
              </div>
              <div
                className={`side-option ${selectedSide === 'black' ? 'selected' : ''}`}
                onClick={() => selectSide('black')}
              >
                <div className="piece">♚</div>
                <div className="label">Play as Black</div>
              </div>
            </div>
            <button className="play-button" onClick={startGame}>
              ⚔️ Start New Game ⚔️
            </button>
          </div>

          {/* Lobby for joining existing games */}
          <div className={`lobby`}>
            <h2>Available Games</h2>
            {availableGames.length === 0 ? (
              <p>No active games. Create one!</p>
            ) : (
              <ul className="game-list">{availableGames.map((game) => {
                const isUsersGame = game.id === user;  
                let availableSide = game.color;
                return (
                  <li key={game.id} className="game-item">
                    <span className="game-id">Player: {game.id}</span>

                    {isUsersGame ? (
                      <button className="join-button disabled" disabled>
                        Your Game
                      </button>
                    ) : availableSide ? (
                      <button
                        className={`join-button join-${availableSide}`}
                        onClick={() => { joinGame(game.id, availableSide);}}
                      >
                        Join {availableSide.charAt(0).toUpperCase() + availableSide.slice(1)}
                      </button>
                    ) : (
                      <button className="join-button disabled" disabled>
                        Full
                      </button>
                    )}
                  </li>
                );
              })}
              </ul>
            )}
          </div>

        </div>
      </div>

      <footer className="game-footer">
        <p>Bonk Chess - Multiplayer Chess Game</p>
      </footer>
    </div>
  );
}

export default Game;
