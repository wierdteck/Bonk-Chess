import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { registerUser, loginUser, getUserById } from './auth.js';
import { redis } from '../db/redis.js';

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

// Socket.IO connection handler
io.on('connection', (socket) => {
  const session = socket.request.session;
  const username = session?.username;
  
  console.log('User connected:', socket.id, username ? `(${username})` : '(guest)');

  socket.on('findGame', () => {
    if (!username) {
      socket.emit('error', 'Must be logged in to play');
      return;
    }
    
    console.log('Player looking for game:', username);
    
    if (waitingPlayers.length > 0) {
      // Match with waiting player
      const opponent = waitingPlayers.shift();
      const gameId = `game-${Date.now()}`;
      
      const game = {
        id: gameId,
        white: { socketId: socket.id, username },
        black: { socketId: opponent.id, username: opponent.username },
        board: initializeBoard(),
        currentTurn: 'white',
        moveHistory: []
      };
      
      games.set(gameId, game);
      
      socket.join(gameId);
      opponent.join(gameId);
      
      socket.emit('gameStart', { 
        gameId, 
        color: 'white',
        opponent: opponent.username
      });
      
      opponent.emit('gameStart', { 
        gameId, 
        color: 'black',
        opponent: username
      });
      
      io.to(gameId).emit('gameState', game);
      
      console.log(`Game started: ${gameId} - ${username} vs ${opponent.username}`);
    } else {
      // Add to waiting list
      waitingPlayers.push({ ...socket, username });
      socket.emit('waiting');
      console.log('Player added to waiting list:', username);
    }
  });

  socket.on('move', ({ gameId, move }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    // Validate it's the player's turn
    const isWhite = socket.id === game.white.socketId;
    const isBlack = socket.id === game.black.socketId;
    
    if ((game.currentTurn === 'white' && !isWhite) || 
        (game.currentTurn === 'black' && !isBlack)) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    // Apply move (basic implementation - add validation later)
    game.moveHistory.push(move);
    game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
    
    // Broadcast move to both players
    io.to(gameId).emit('move', move);
    io.to(gameId).emit('gameState', game);
  });

  socket.on('resign', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return;
    
    const winner = socket.id === game.white.socketId ? game.black : game.white;
    io.to(gameId).emit('gameOver', { 
      reason: 'resignation', 
      winner: winner.username
    });
    
    games.delete(gameId);
    console.log(`Game ${gameId} ended by resignation`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id, username ? `(${username})` : '(guest)');
    
    // Remove from waiting list
    const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
    if (waitingIndex !== -1) {
      waitingPlayers.splice(waitingIndex, 1);
      console.log('Removed from waiting list');
    }
    
    // Handle active games
    games.forEach((game, gameId) => {
      if (game.white.socketId === socket.id || game.black.socketId === socket.id) {
        const opponent = game.white.socketId === socket.id ? game.black : game.white;
        io.to(opponent.socketId).emit('opponentDisconnected');
        games.delete(gameId);
        console.log(`Game ${gameId} ended due to disconnection`);
      }
    });
  });
});

// Initialize chess board
function initializeBoard() {
  return [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ];
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
      socket: 'ws://localhost:3000'
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