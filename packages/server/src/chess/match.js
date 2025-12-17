import { applyMove } from './gameLogic.js';
import { initializeBoard } from './initializeBoard.js';
import { GameTimers } from './timers.js';

export class Match {
  constructor({ id, white = null, black = null, io, timeControl = { initialSeconds: 300, incrementSeconds: 0 } }) {
    this.id = id;
    this.white = white;
    this.black = black;
    this.io = io;

    this.board = initializeBoard();
    this.currentTurn = 'white';
    this.enPassantTarget = null; // added
    this.moveHistory = [];
    this.gameOver = false;
    this.winner = null;
    this.reason = null;

    this.timers = new GameTimers({
      gameId: id,
      initialSeconds: timeControl.initialSeconds,
      incrementSeconds: timeControl.incrementSeconds,
      onTick: (gameId, timers) => this.io.to(gameId).emit('timerUpdate', timers),
      onTimeout: (gameId, color) => {
        const winner = color === 'white' ? 'black' : 'white';
        this._endGame({ winner, reason: 'timeout' });
      }
    });
  }

  startIfReady() {
    if (this.white && this.black && !this.timers.active && !this.gameOver) {
      this.timers.start('white');
    }
  }

  addPlayer({ socketId, username, side }) {
    if (side === 'white') this.white = { socketId, username };
    else this.black = { socketId, username };
    this.startIfReady();
  }

  removePlayer(socketId) {
    if (this.white?.socketId === socketId) this.white = null;
    if (this.black?.socketId === socketId) this.black = null;
    this.timers.stop();
  }

  makeMove(socketId, move) {
    if (this.gameOver) return { error: 'Game is already over' };

    const isWhite = socketId === this.white?.socketId;
    const isBlack = socketId === this.black?.socketId;

    if ((this.currentTurn === 'white' && !isWhite) || (this.currentTurn === 'black' && !isBlack)) {
      return { error: 'Not your turn' };
    }

    // Apply move
    const result = applyMove({
      board: this.board,
      currentTurn: this.currentTurn,
      enPassantTarget: this.enPassantTarget
    }, move);

    if (result.error) return result;

    // Update match state
    this.board = result.board;
    this.currentTurn = result.turn;
    this.enPassantTarget = result.enPassantTarget || null;

    this.moveHistory.push(move);
    this.timers.switchTurn();

    this.io.to(this.id).emit('move', move);
    this.io.to(this.id).emit('gameState', this.getState());
    return { success: true };
  }

  resign(socketId) {
    if (this.gameOver) return;
    const winnerSide = this.white?.socketId === socketId ? 'black' : 'white';
    this._endGame({ winner: winnerSide, reason: 'resignation' });
  }

  _endGame({ winner, reason }) {
    this.gameOver = true;
    this.winner = winner;
    this.reason = reason;
    this.timers.stop();
    this.io.to(this.id).emit('gameOver', {
      winner: winner === 'white' ? this.white?.username : this.black?.username,
      reason
    });
  }

  getState() {
    return {
      id: this.id,
      white: this.white && { username: this.white.username },
      black: this.black && { username: this.black.username },
      board: this.board,
      currentTurn: this.currentTurn,
      enPassantTarget: this.enPassantTarget, // expose
      moveHistory: this.moveHistory,
      gameOver: this.gameOver,
      winner: this.winner,
      reason: this.reason
    };
  }
}
