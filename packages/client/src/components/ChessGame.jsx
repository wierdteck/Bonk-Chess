import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import './Game.css';

// Unicode chess pieces
const PIECES = {
  P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔',
  p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚'
};

function ChessGame({ user }) {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [board, setBoard] = useState([]);
  const [turn, setTurn] = useState("white");
  const [color, setColor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timers, setTimers] = useState({whiteSeconds: 0,  blackSeconds: 0,  active: 'white',});
  const [gameOver, setGameOver] = useState(null);

  useEffect(() => {
    if (!gameId) return;

    socket.emit('joinGame', { gameId });
    
    socket.on('getName', (callback) => {
      callback(user);
    });

    socket.on('timerUpdate', (timers) => {
      setTimers({
        whiteSeconds: timers.whiteSeconds,
        blackSeconds: timers.blackSeconds,
        active: timers.active,
      });
      setTurn(timers.active);
    });
    
    socket.on('game-init', (state) => {
      setBoard(state.board);
      setTurn(state.currentTurn);
      setColor(state.white?.username === user ? 'white' : 'black');
    });

    socket.on('gameOver', ({reason, winner}) => {
      console.log("Game Over", reason, winner);
      setGameOver({reason, winner});
    });

    socket.on('gameState', (state) => {
      setBoard(state.board);
      setTurn(state.currentTurn);
      // setGameOver(state.gameOver);
    });

    socket.on('noMatch', (reason) => {
      alert(reason, " returning to lobby");
      navigate('/lobby');
    });

    return () => {
      socket.off('game-init');
      socket.off('gameState');
      socket.off('getName');
      socket.off('gameOver');
      socket.off('noMatch');
      socket.off('timerUpdate');
    };
  }, [gameId, user]);

  const handleCellClick = (col, row) => {
    if (gameOver) return;
    // console.log("Clicked on cell:", row, col);
    if (!selected) {
      if (board[row][col].color === color) setSelected([col, row]);
      return;
    }
    // const piece = selected ? board[selected[1]][selected[0]] : null;

    socket.emit("move", { gameId, move: { from: [selected[1], selected[0]], to: [row, col] } });
    setSelected(null);
  };

  const resign = () => {
    socket.emit("resign", { gameId })
    navigate('/lobby');
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  if (!board || board.length === 0) return <div className="game-content">Loading board...</div>;

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="title">Bonk Chess</h1>
        <div className="user-info">
          <span>You are: <strong>{color}</strong></span>
          <span>Turn: <strong>{turn}</strong></span>
          <span style={{ fontWeight: timers.active === 'white' ? 'bold' : 'normal' }}>
            White: {formatTime(timers.whiteSeconds)}
          </span>
          <span style={{ fontWeight: timers.active === 'black' ? 'bold' : 'normal' }}>
            Black: {formatTime(timers.blackSeconds)}
          </span>
          <button className="logout-btn" onClick={() => navigate('/lobby')}>Back to Lobby</button>
        </div>
      </div>

      <div className="game-main">
        <div className="game-content">
          <ChessBoard
            board={board.map(row => row.map(cell => {
              if (!cell) return null;
              // Uppercase for white, lowercase for black
              return cell.color === 'white' ? cell.type.toUpperCase() : cell.type;
            }))}
            selected={selected}
            onCellClick={handleCellClick}
            color={color}
          />
          <button className="play-button" onClick={resign} style={{ marginTop: '1rem' }}>Resign</button>
        </div>
      </div>

      {gameOver && (
        <div className="game-content" style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <h2>Game Over</h2>
          <p>Reason: {gameOver.reason}</p>
          <p>Winner: {gameOver.winner}</p>
          <button className="play-button" onClick={() => navigate('/lobby')}>Back to Lobby</button>
        </div>
      )}
    </div>
  );
}

function ChessBoard({ board, onCellClick, selected, color }) {
  // Flip board for black view
  const tempBoard =
    color === "black"
      ? [...board].map(row => [...row].reverse()).reverse()
      : board;
  const orientedBoard = tempBoard[0].map((_, colIndex) =>
    tempBoard.map(row => row[colIndex])
  );
  return (
    <div className="chess-board">
      {orientedBoard.map((row, i) => (
        <div key={i} className="chess-row">
          {row.map((cell, j) => {
            const isSelected =
              selected &&
              selected[0] === (color === "black" ? 7 - i : i) &&
              selected[1] === (color === "black" ? 7 - j : j);

            return (
              <div
                key={j}
                className={`chess-cell ${isSelected ? "selected" : ""} ${
                  (i + j) % 2 === 0 ? "light-cell" : "dark-cell"
                }`}
                onClick={() => {
                  const trueRow = color === "black" ? 7 - i : i;
                  const trueCol = color === "black" ? 7 - j : j;
                  onCellClick(trueRow, trueCol);
                }}
              >
                {PIECES[cell] || ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


export default ChessGame;
