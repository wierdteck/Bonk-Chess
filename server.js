const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Game state management
const games = new Map(); // gameId -> game object
const waitingPlayers = []; // players waiting for a match

class Game {
    constructor(gameId, player1, player2) {
        this.id = gameId;
        this.players = [player1, player2];
        this.currentPlayer = 'white';
        this.gameBoard = this.initializeBoard();
        this.gameOver = false;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.kingMoved = { white: false, black: false };
        this.rookMoved = {
            white: { kingside: false, queenside: false },
            black: { kingside: false, queenside: false }
        };
        this.enPassantTarget = null;
        
        // Assign sides randomly
        if (Math.random() < 0.5) {
            this.players[0].side = 'white';
            this.players[1].side = 'black';
        } else {
            this.players[0].side = 'black';
            this.players[1].side = 'white';
        }
    }

    initializeBoard() {
        return [
            [{type: 'rook', color: 'black'}, {type: 'knight', color: 'black'}, {type: 'bishop', color: 'black'}, {type: 'queen', color: 'black'}, {type: 'king', color: 'black'}, {type: 'bishop', color: 'black'}, {type: 'knight', color: 'black'}, {type: 'rook', color: 'black'}],
            [{type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [{type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}],
            [{type: 'rook', color: 'white'}, {type: 'knight', color: 'white'}, {type: 'bishop', color: 'white'}, {type: 'queen', color: 'white'}, {type: 'king', color: 'white'}, {type: 'bishop', color: 'white'}, {type: 'knight', color: 'white'}, {type: 'rook', color: 'white'}]
        ];
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
        
        const piece = this.gameBoard[fromRow][fromCol];
        const targetPiece = this.gameBoard[toRow][toCol];
        
        if (!piece) return false;
        
        const pieceColor = piece.color;
        const pieceType = piece.type;
        
        // Can't capture own pieces
        if (targetPiece && targetPiece.color === pieceColor) return false;
        
        // Check for castling
        if (pieceType === 'king' && Math.abs(toCol - fromCol) === 2) {
            if(toRow === fromRow) return this.isValidCastling(fromRow, fromCol, toCol);
            else return false;
        }
        
        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const absRowDiff = Math.abs(rowDiff);
        const absColDiff = Math.abs(colDiff);
        
        switch (pieceType) {
            case 'pawn':
                return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, pieceColor);
            case 'rook':
                return (rowDiff === 0 || colDiff === 0) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'bishop':
                return absRowDiff === absColDiff && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'queen':
                return ((rowDiff === 0 || colDiff === 0) || (absRowDiff === absColDiff)) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'king':
                return absRowDiff <= 1 && absColDiff <= 1;
            case 'knight':
                return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
        }
        
        return false;
    }

    isValidCastling(fromRow, fromCol, toCol) {
        const color = this.gameBoard[fromRow][fromCol].color;
        
        if (this.kingMoved[color]) return false;
        
        const isKingside = toCol > fromCol;
        const rookCol = isKingside ? 7 : 0;
        
        if (this.rookMoved[color][isKingside ? 'kingside' : 'queenside']) return false;
        
        const startCol = Math.min(fromCol, rookCol);
        const endCol = Math.max(fromCol, rookCol);
        for (let col = startCol + 1; col < endCol; col++) {
            if (this.gameBoard[fromRow][col] !== null) return false;
        }
        
        return true;
    }

    isValidPawnMove(fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);
        
        if (colDiff === 0 && !this.gameBoard[toRow][toCol]) {
            if (rowDiff === direction) return true;
            if (fromRow === startRow && rowDiff === 2 * direction) return true;
        }
        
        if (colDiff === 1 && rowDiff === direction && this.gameBoard[toRow][toCol]) {
            return this.gameBoard[toRow][toCol].color !== color;
        }
        
        if (colDiff === 1 && rowDiff === direction && !this.gameBoard[toRow][toCol]) {
            if (this.enPassantTarget && this.enPassantTarget.row === toRow && this.enPassantTarget.col === toCol) {
                return true;
            }
        }
        
        return false;
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
        const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.gameBoard[currentRow][currentCol] !== null) return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.gameBoard[fromRow][fromCol];
        const isKing = piece.type === 'king';
        const isRook = piece.type === 'rook';
        const isPawn = piece.type === 'pawn';
        
        // Check if capturing a king - game over
        const targetPiece = this.gameBoard[toRow][toCol];
        if (targetPiece && targetPiece.type === 'king') {
            this.gameOver = true;
        }
        
        // Handle castling
        if (isKing && Math.abs(toCol - fromCol) === 2) {
            const isKingside = toCol > fromCol;
            const rookFromCol = isKingside ? 7 : 0;
            const rookToCol = isKingside ? 5 : 3;
            
            this.gameBoard[fromRow][rookToCol] = this.gameBoard[fromRow][rookFromCol];
            this.gameBoard[fromRow][rookFromCol] = null;
            this.checkAndDestroyPieceInFront(fromRow, rookToCol);
        }
        
        // Handle en passant capture
        if (isPawn && this.enPassantTarget && toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
            const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
            this.gameBoard[capturedPawnRow][toCol] = null;
        }
        
        // Update castling rights
        if (isKing) {
            this.kingMoved[piece.color] = true;
        }
        
        if (isRook) {
            if (fromCol === 0) {
                this.rookMoved[piece.color].queenside = true;
            } else if (fromCol === 7) {
                this.rookMoved[piece.color].kingside = true;
            }
        }
        
        if (targetPiece && targetPiece.type === 'rook') {
            if (toCol === 0) {
                this.rookMoved[targetPiece.color].queenside = true;
            } else if (toCol === 7) {
                this.rookMoved[targetPiece.color].kingside = true;
            }
        }
        
        // Set en passant target for next turn
        this.enPassantTarget = null;
        if (isPawn && Math.abs(toRow - fromRow) === 2) {
            const targetRow = fromRow + (toRow - fromRow) / 2;
            this.enPassantTarget = { row: targetRow, col: fromCol };
        }
        
        // Make the move
        this.gameBoard[toRow][toCol] = this.gameBoard[fromRow][fromCol];
        this.gameBoard[fromRow][fromCol] = null;
        
        // Handle pawn promotion
        if (isPawn && ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7))) {
            this.gameBoard[toRow][toCol] = { type: 'queen', color: piece.color };
        }
        
        this.checkAndDestroyPieceInFront(toRow, toCol);
        
        // Switch current player
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        return true;
    }

    checkAndDestroyPieceInFront(row, col) {
        const piece = this.gameBoard[row][col];
        if (!piece) return;
        
        const direction = piece.color === 'white' ? -1 : 1;
        const frontRow = row + direction;
        
        if (frontRow < 0 || frontRow >= 8) return;
        
        const frontPiece = this.gameBoard[frontRow][col];
        if (frontPiece && frontPiece.color !== piece.color) {
            if (frontPiece.type === 'king') {
                this.gameOver = true;
            }
            this.gameBoard[frontRow][col] = null;
        }
    }

    getGameState() {
        return {
            gameBoard: this.gameBoard,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            castlingRights: this.castlingRights,
            kingMoved: this.kingMoved,
            rookMoved: this.rookMoved,
            enPassantTarget: this.enPassantTarget
        };
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Handle player looking for a game
    socket.on('find-game', () => {
        if (waitingPlayers.length > 0) {
            // Match with waiting player
            const opponent = waitingPlayers.pop();
            const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const game = new Game(gameId, 
                { id: socket.id, socket: socket }, 
                { id: opponent.id, socket: opponent.socket }
            );
            
            games.set(gameId, game);
            
            // Join both players to the game room
            socket.join(gameId);
            opponent.socket.join(gameId);
            
            // Notify both players that game started
            socket.emit('game-started', {
                gameId: gameId,
                side: game.players[0].side,
                opponent: opponent.id,
                gameState: game.getGameState()
            });
            
            opponent.socket.emit('game-started', {
                gameId: gameId,
                side: game.players[1].side,
                opponent: socket.id,
                gameState: game.getGameState()
            });
            
            console.log(`Game ${gameId} started between ${socket.id} and ${opponent.id}`);
        } else {
            // Add to waiting list
            waitingPlayers.push({ id: socket.id, socket: socket });
            socket.emit('waiting-for-opponent');
            console.log(`Player ${socket.id} added to waiting list`);
        }
    });

    // Handle moves
    socket.on('make-move', (data) => {
        const { gameId, fromRow, fromCol, toRow, toCol } = data;
        const game = games.get(gameId);
        
        if (!game || game.gameOver) {
            socket.emit('invalid-move', 'Game not found or already over');
            return;
        }
        
        // Find which player is making the move
        const player = game.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('invalid-move', 'Player not in this game');
            return;
        }
        
        // Check if it's the player's turn
        if (player.side !== game.currentPlayer) {
            socket.emit('invalid-move', 'Not your turn');
            return;
        }
        
        // Validate the move
        if (!game.isValidMove(fromRow, fromCol, toRow, toCol)) {
            socket.emit('invalid-move', 'Invalid move');
            return;
        }
        
        // Make the move
        game.makeMove(fromRow, fromCol, toRow, toCol);
        
        // Broadcast the move to both players
        io.to(gameId).emit('move-made', {
            fromRow, fromCol, toRow, toCol,
            gameState: game.getGameState(),
            playerId: socket.id
        });
        
        // Check if game is over
        if (game.gameOver) {
            io.to(gameId).emit('game-over', {
                winner: player.side,
                gameState: game.getGameState()
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Remove from waiting list if they were waiting
        const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }
        
        // Handle game disconnection
        for (const [gameId, game] of games.entries()) {
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                // Notify opponent that player disconnected
                const opponent = game.players[1 - playerIndex];
                opponent.socket.emit('opponent-disconnected');
                
                // Clean up the game
                games.delete(gameId);
                break;
            }
        }
    });

    // Handle reconnection to existing game
    socket.on('reconnect-game', (gameId) => {
        const game = games.get(gameId);
        if (game) {
            const player = game.players.find(p => p.id === socket.id);
            if (player) {
                socket.join(gameId);
                socket.emit('game-rejoined', {
                    gameId: gameId,
                    side: player.side,
                    gameState: game.getGameState()
                });
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local access: http://localhost:${PORT}`);
    console.log(`Network access: http://YOUR_PUBLIC_IP:${PORT}`);
});