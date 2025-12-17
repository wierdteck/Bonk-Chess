import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { registerUser, loginUser, getUserById } from './auth.js';
import { redis } from '../db/redis.js';
import { applyMove } from './chess/gameLogic.js';
import { initializeBoard } from './chess/initializeBoard.js';
import { getAllMatchesIds, createMatch, getMatch, joinMatch, makeMatchMove, resignMatch, endMatch, listAvailableMatches } from './chess/gameManager.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const httpServer = createServer(app);


// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Session configuration with Redis
const sessionMiddleware = session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET || 'bonk-chess-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax'
  }
});

app.use(sessionMiddleware);

// Socket.IO setup with session support
const io = new Server(httpServer, {
  cors: corsOptions
});

// Share session with Socket.IO
io.engine.use(sessionMiddleware);

// Game state
const games = new Map();
const waitingPlayers = [];

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  const { username, password, passwordConfirm } = req.body;
  
  const result = await registerUser(username, password, passwordConfirm);
  
  if (result.success) {
    // Store user in session
    const user = await getUserById(result.userId);
    req.session.userId = result.userId;
    req.session.username = result.username;
    res.json({ success: true, username: result.username });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  const result = await loginUser(username, password);
  
  if (result.success) {
    // Store user in session
    req.session.userId = result.userId;
    req.session.username = result.username;
    res.json({ success: true, username: result.username });
  } else {
    res.status(401).json({ success: false, error: result.error });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    console.log(`User logged out: ${username}`);
    res.json({ success: true });
  });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const user = await getUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  
  res.json({ 
    success: true, 
    username: user.username,
    userId: user.id
  });
});

io.on('connection', (socket) => {
  broadcastLobby();
  const session = socket.request.session;
  const username = session?.username || 'guest';

  console.log(`User connected: ${socket.id} ${username !== 'guest' ? `(${username})` : ''}`);
  socket.on('request-lobby', () => {
    console.log("Lobby requested by:", socket.id);
    broadcastLobby();
  });

  // --------------------
  // CREATE GAME
  // --------------------
  socket.on('createGame', ({ side, player, timeControl }, callback) => {
    const gameId = `${player}`;

    const tc = timeControl || {
      initialSeconds: 300,
      incrementSeconds: 0
    };

    createMatch({
      id: gameId,
      socketId: socket.id,
      username: player,
      side,
      io,
      timeControl: tc
    });

    socket.join(gameId);
    callback?.({ gameId, color: side });
    broadcastLobby();
  });

  // --------------------
  // JOIN GAME
  // --------------------
  socket.on("join-game", ({ gameId, username }) => {
    // Mirror to new joinGame API
    socket.emit('joinGame', { gameId, side: null, username });
  });
  socket.on("joinGame", ({ gameId, side, username}, callback) => {
    const match = getMatch(gameId);
    // console.log(username, "joining game:", gameId);
    if (!match) {
      // Create new match with this player (if gameId is custom)
      const newMatch = joinMatch({ id: gameId, socketId: socket.id, username, side, io });
      socket.join(gameId);
      io.to(socket.id).emit('game-init', newMatch.getState());
      if (typeof callback === 'function') {
        callback({ success: true, created: true }); // for new match
      }
      return;
    }

    // Join existing
    joinMatch({ id: gameId, socketId: socket.id, username, side, io });
    socket.join(gameId);

    // Redirect both players to the actual game
    const players = [match.white, match.black].filter(Boolean);
    players.forEach(p => {
      io.to(p.socketId).emit("redirect-to-game", { gameId });
    });

    // Send initial state
    io.to(gameId).emit('game-init', match.getState());
    broadcastLobby();
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });


  // --------------------
  // MAKE MOVE
  // --------------------
  socket.on('move', ({ gameId, move }) => {
    const match = getMatch(gameId);
    if (!match || match.gameOver) {
      socket.emit('error', 'Game not found or already over');
      return;
    }
    // console.log(`move received from ${socket.id} in game ${gameId}:`, move);
    const res = makeMatchMove({ id: gameId, socketId: socket.id, move });
    // console.log(`move result:`, res);
    if (res.error) {
      socket.emit('error', res.error);
      return;
    }
    // match emits gameState internally
  });

  // --------------------
  // RESIGN GAME
  // --------------------
  socket.on('resign', ({ gameId }) => {
    const match = getMatch(gameId);
    if (!match) return;
    const winner = match.white?.socketId === socket.id ? match.black?.username : match.white?.username;
    match.resign(socket.id);
    endMatch({ id: gameId });
    io.to(gameId).emit('gameOver', { reason: 'resignation', winner: winner || 'unknown' });
  });

  // --------------------
  // DISCONNECT HANDLING
  // --------------------
  socket.on('disconnect', () => {
    // Remove from waitingPlayers
    const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
    if (waitingIndex !== -1) waitingPlayers.splice(waitingIndex, 1);

    // Clean up matches: resign or remove player
    games.forEach((game, gameId) => {
      // (This part uses the previous inline system. In the new system we loop matches)
    });

    // cleanup new system matches
    const matchIds = Array.from(getAllMatchesIds ? getAllMatchesIds() : []).map(i => i); // if getAllMatchesIds exists
    matchIds.forEach((id) => {
      const match = getMatch(id);
      if (!match) return;
      if (match.white?.socketId === socket.id || match.black?.socketId === socket.id) {
        const opponent = match.white?.socketId === socket.id ? match.black : match.white;
        if (opponent?.socketId) io.to(opponent.socketId).emit('opponentDisconnected');
        resignMatch({ id: id, socketId: socket.id }); // treat as resignation / game ended
      }
    });

    broadcastLobby();
  });
});

function broadcastLobby() {
  const available = listAvailableMatches();
  io.emit('lobby-update', available);
}


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    games: games.size,
    waiting: waitingPlayers.length,
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Bonk Chess Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      register: '/api/auth/register',
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      me: '/api/auth/me',
      socket: 'i dont even know where'
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Bonk Chess server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
});