import { Match } from './match.js';
import { initializeBoard } from './initializeBoard.js';
import { applyMove } from './gameLogic.js';
const matches = new Map();

function getBoardPosition(board, position) {
  const [row, col] = position;

  // Check if the row and column exist in the board
  if (
    !Array.isArray(board) ||
    row < 0 || row >= board.length ||
    col < 0 || col >= (board[row]?.length || 0)
  ) {
    return null;
  }

  return board[row][col];
}

export function createMatch({ id, socketId, username, side, io, timeControl }) {
  const white = side === 'white' ? { socketId, username } : null;
  const black = side === 'black' ? { socketId, username } : null;
  const match = new Match({ id, white, black, io, timeControl });

  // Initialize board
  match.gameState = {
    board: initializeBoard(),
    currentTurn: 'white',
    enPassantTarget: null,
    gameOver: false
  };

  matches.set(id, match);
  return match;
}

export function getMatch(id) {
  return matches.get(id);
}

export function joinMatch({ id, socketId, username, side, io, timeControl }) {
  const match = matches.get(id);


  
  if (!match.white && side === 'white') match.addPlayer({ socketId, username, side: 'white' });
  else if (!match.black && side === 'black') match.addPlayer({ socketId, username, side: 'black' });
  else if (!match.white) match.addPlayer({ socketId, username, side: 'white' });
  else if (!match.black) match.addPlayer({ socketId, username, side: 'black' });
  return match;
}

export function makeMatchMove({ id, socketId, move }) {
  const match = matches.get(id);
  if (!match) return { error: 'Match not found' };
  const playerWhoMoved = match.gameState.currentTurn;

  const res = applyMove(match.gameState, move);
  if (res.error) return { error: res.error };

  // console.log('piece', match.board[move.to[0]]);
  // console.log('piece', piece);
  if(res.win === 1){
    match.gameState.gameOver = true;
    const winner = playerWhoMoved === 'white' ? match.white?.username : match.black?.username;
    console.log('gameOver', winner)
    match.io.to(id).emit('gameOver', {reason: 'king taken', winner: winner || 'unknown'});
  }
  if(res.win === 2){
    match.gameState.gameOver = true;
    const winner = playerWhoMoved === 'white' ? match.white?.username : match.black?.username;
    console.log('gameOver', winner)
    match.io.to(id).emit('gameOver', {reason: 'king bonked', winner: winner || 'unknown'});
  }
  // Broadcast new state
  match.io.to(id).emit('gameState', match.gameState);

  return { success: true, board: match.gameState.board, currentTurn: match.gameState.currentTurn };
}

export function resignMatch({ id, socketId }) {
  const match = matches.get(id);
  if (!match) return;
  match.resign(socketId);
  matches.delete(id);
}

export function endMatch({ id }) {
  const match = matches.get(id);
  if (!match) return;
  matches.delete(id);
}

export function listAvailableMatches() {
  const available = [];
  matches.forEach((m, id) => {
    const count = [m.white, m.black].filter(Boolean).length;
    if (!m.gameOver && count < 2) {
      const color = !m.white ? 'white' : !m.black ? 'black' : null;
      available.push({ id, color });
    }
  });
  return available;
}
export function getAllMatchesIds() {
  return Array.from(matches.keys());
}