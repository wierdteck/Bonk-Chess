const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { registerUser, loginUser } = require('./auth');

const app = express();
const httpServer = createServer(app);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  const { username, password, passwordConfirm } = req.body;
  
  const result = await registerUser(username, password, passwordConfirm);
  
  if (result.success) {
    res.json({ success: true, username: result.username });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  const result = await loginUser(username, password);
  
  if (result.success) {
    res.json({ success: true, username: result.username });
  } else {
    res.status(401).json({ success: false, error: result.error });
  }
});

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Game state
const games = new Map();
const waitingPlayers = [];

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('findGame', () => {
    console.log('Player looking for game:', socket.id);
    
    if (waitingPlayers.length > 0) {
      // Match with waiting player
      const opponent = waitingPlayers.shift();
      const gameId = `game-${Date.now()}`;
      
      const game = {
        id: gameId,
        white: socket.id,
        black: opponent.id,
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
        opponent: opponent.id 
      });
      
      opponent.emit('gameStart', { 
        gameId, 
        color: 'black',
        opponent: socket.id 
      });
      
      io.to(gameId).emit('gameState', game);
      
      console.log(`Game started: ${gameId}`);
    } else {
      // Add to waiting list
      waitingPlayers.push(socket);
      socket.emit('waiting');
      console.log('Player added to waiting list');
    }
  });

  socket.on('move', ({ gameId, move }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    // Validate it's the player's turn
    const isWhite = socket.id === game.white;
    const isBlack = socket.id === game.black;
    
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
    
    const winner = socket.id === game.white ? game.black : game.white;
    io.to(gameId).emit('gameOver', { 
      reason: 'resignation', 
      winner 
    });
    
    games.delete(gameId);
    console.log(`Game ${gameId} ended by resignation`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from waiting list
    const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
    if (waitingIndex !== -1) {
      waitingPlayers.splice(waitingIndex, 1);
      console.log('Removed from waiting list');
    }
    
    // Handle active games
    games.forEach((game, gameId) => {
      if (game.white === socket.id || game.black === socket.id) {
        const opponent = game.white === socket.id ? game.black : game.white;
        io.to(opponent).emit('opponentDisconnected');
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