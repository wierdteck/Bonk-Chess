import { Match } from './match.js';

const matches = new Map();

export function createMatch({ id, socketId, username, side, io, timeControl }) {
  const white = side === 'white' ? { socketId, username } : null;
  const black = side === 'black' ? { socketId, username } : null;
  const match = new Match({ id, white, black, io, timeControl });
  matches.set(id, match);
  return match;
}

export function getMatch(id) {
  return matches.get(id);
}

export function joinMatch({ id, socketId, username, side, io, timeControl }) {
  const match = matches.get(id);
  if (!match) {
    // create new as fallback
    console.log('Match not found, creating new one');
    return createMatch({ id, socketId, username, side, io, timeControl });
  }
  console.log('creating match');
  // If side specified, use it, else fill empty.
//   console.log('match', match.black, match.white, side);
// console.log('username', username);
  if (!match.white && side === 'white') match.addPlayer({ socketId, username, side: 'white' });
  else if (!match.black && side === 'black') match.addPlayer({ socketId, username, side: 'black' });
  else if (!match.white) match.addPlayer({ socketId, username, side: 'white' });
  else if (!match.black) match.addPlayer({ socketId, username, side: 'black' });
//   console.log('match', match.black, match.white, side);
  return match;
}

export function makeMatchMove({ id, socketId, move }) {
  const match = matches.get(id);
  if (!match) return { error: 'Match not found' };
  return match.makeMove(socketId, move);
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