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
  const [timers, setTimers] = useState({ whiteSeconds: 0, blackSeconds: 0 });
  const [gameOver, setGameOver] = useState(null);

  useEffect(() => {
    if (!gameId) return;
    socket.emit("joinGame", { gameId });

    socket.on("game-init", ({ board, currentTurn, white, black }) => {
      setBoard(board);
      setTurn(currentTurn || 'white');
      if (white?.username === user) setColor('white');
      if (black?.username === user) setColor('black');
    });

    socket.on("gameState", (state) => {
      setBoard(state.board);
      setTurn(state.currentTurn);
      setGameOver(state.gameOver);
    });

    socket.on("timerUpdate", setTimers);
    socket.on("gameOver", setGameOver);
    socket.on("opponentDisconnected", () => setGameOver({ reason: 'opponent_disconnected', winner: 'you' }));

    return () => {
      socket.emit("leave-game", { gameId });
      socket.off("game-init");
      socket.off("gameState");
      socket.off("timerUpdate");
      socket.off("gameOver");
      socket.off("opponentDisconnected");
    };
  }, [gameId, user]);

  const handleCellClick = (row, col) => {
    if (gameOver) return;

    const piece = board[row][col];
    if (!selected) {
      const isMyPiece = (color === 'white' && piece && piece === piece.toUpperCase()) ||
                        (color === 'black' && piece && piece === piece.toLowerCase());
      if (isMyPiece) setSelected([row, col]);
      return;
    }

    socket.emit("move", { gameId, move: { from: selected, to: [row, col] } });
    setSelected(null);
  };

  const resign = () => socket.emit("resign", { gameId });

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
          <span>White: {formatTime(timers.whiteSeconds)}</span>
          <span>Black: {formatTime(timers.blackSeconds)}</span>
          <button className="logout-btn" onClick={() => navigate('/lobby')}>Back to Lobby</button>
        </div>
      </div>

      <div className="game-main">
        <div className="game-content">
          <ChessBoard board={board} selected={selected} onCellClick={handleCellClick} />
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

function ChessBoard({ board, onCellClick, selected }) {
  return (
    <div className="chess-board">
      {board.map((row, i) => (
        <div key={i} className="chess-row">
          {row.map((cell, j) => {
            const isSelected = selected && selected[0] === i && selected[1] === j;
            return (
              <div
                key={j}
                className={`chess-cell ${isSelected ? 'selected' : ''} ${((i + j) % 2 === 0 ? 'light-cell' : 'dark-cell')}`}
                onClick={() => onCellClick(i, j)}
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
