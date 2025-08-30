// Multiplayer variables
let socket;
let gameId = null;
let playerSide = null;
let isMultiplayer = false;

// Chess pieces in Unicode
const pieces = {
    'white': {
        'king': '♔', 'queen': '♕', 'rook': '♖',
        'bishop': '♗', 'knight': '♘', 'pawn': '♙'
    },
    'black': {
        'king': '♚', 'queen': '♛', 'rook': '♜',
        'bishop': '♝', 'knight': '♞', 'pawn': '♟'
    }
};

// Game state
let currentPlayer = 'white';
let selectedSquare = null;
let gameBoard = [];
let gameOver = false;
let castlingRights = {
    white: { kingside: true, queenside: true },
    black: { kingside: true, queenside: true }
};
let kingMoved = { white: false, black: false };
let rookMoved = {
    white: { kingside: false, queenside: false },
    black: { kingside: false, queenside: false }
};
let enPassantTarget = null;
let selectedSide = null;

function startGame() {
    // Single-player game
    let gameUrl = "bonk chess.html";
    if (selectedSide !== null) {
        const sideString = selectedSide === 0 ? 'white' : 'black';
        gameUrl += `?side=${sideString}`;
    }
    window.location.href = gameUrl;
}
function selectSide(side) {
    let newSelection = null;

    if (side === 'white') newSelection = 0;
    if (side === 'black') newSelection = 1;

    if (selectedSide === newSelection) {
        selectedSide = null;
        document.querySelectorAll('.side-option.selected').forEach(option => {
            option.classList.remove('selected');
        });
    } else {
        selectedSide = newSelection;
        document.querySelectorAll('.side-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.getElementById(side + 'Option').classList.add('selected');
    }

    console.log("current selectedSide after update:", selectedSide);
}

// Initialize selectedSide from URL parameters
function initializeSelectedSide() {
    const urlParams = new URLSearchParams(window.location.search);
    const sideParam = urlParams.get('side');
    
    if (sideParam === 'white') {
        selectedSide = 0;
    } else if (sideParam === 'black') {
        selectedSide = 1;
    } else {
        selectedSide = null;
    }
    
    console.log("Initialized selectedSide:", selectedSide);

    const controlsDiv = document.querySelector('.controls');
    if (controlsDiv) {
        const backButton = document.createElement('button');
        backButton.textContent = 'Back to Menu';
        backButton.onclick = () => {
            if (socket) {
                socket.disconnect();
            }
            window.location.href = 'index.html';
        };
        controlsDiv.appendChild(backButton);
    }
}

// Initialize multiplayer connection
function initializeMultiplayer() {
    if (typeof io === 'undefined') {
        console.log('Socket.io not loaded, running in single-player mode');
        return false;
    }
    
    socket = io();
    isMultiplayer = true;
    
    // Connection status events
    socket.on('connect', () => {
        updateConnectionStatus(true);
        console.log('Connected to server');
    });
    
    socket.on('disconnect', () => {
        updateConnectionStatus(false);
        console.log('Disconnected from server');
    });
    
    // Socket event listeners
    socket.on('waiting-for-opponent', () => {
        updateGameStatus('<span class="waiting-animation">Waiting for opponent...</span>');
    });
    
    socket.on('game-started', (data) => {
        gameId = data.gameId;
        playerSide = data.side;
        selectedSide = playerSide === 'white' ? 0 : 1;
        
        // Update game state from server
        updateGameStateFromServer(data.gameState);
        createBoard();
        
        // Add player side indicator
        addPlayerSideIndicator();
        
        updateGameStatus(`Game started! You are playing as ${playerSide}`);
        console.log('Game started:', data);
    });
    
    socket.on('move-made', (data) => {
        // Update game state from server
        updateGameStateFromServer(data.gameState);
        createBoard();
        clearSelection();
        
        if (data.gameState.gameOver) {
            const winner = data.playerId === socket.id ? playerSide : (playerSide === 'white' ? 'black' : 'white');
            updateGameStatus(`Game Over! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`);
        } else {
            updateGameStatus();
        }
    });
    
    socket.on('invalid-move', (message) => {
        console.log('Invalid move:', message);
        clearSelection();
        updateGameStatus('Invalid move! Try again.');
        setTimeout(() => updateGameStatus(), 2000);
    });
    
    socket.on('opponent-disconnected', () => {
        updateGameStatus('Opponent disconnected. You win!');
        gameOver = true;
    });
    
    socket.on('game-over', (data) => {
        gameOver = true;
        updateGameStatus(`Game Over! ${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins!`);
    });
    
    return true;
}

// Update game state from server
function updateGameStateFromServer(serverState) {
    gameBoard = serverState.gameBoard;
    currentPlayer = serverState.currentPlayer;
    gameOver = serverState.gameOver;
    castlingRights = serverState.castlingRights;
    kingMoved = serverState.kingMoved;
    rookMoved = serverState.rookMoved;
    enPassantTarget = serverState.enPassantTarget;
    
    // Update current player display
    document.getElementById('currentPlayer').textContent = 
        currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
}

// Helper function to get display coordinates based on board orientation
function getDisplayCoordinates(row, col) {
    if (selectedSide === 1) {
        return {
            displayRow: 7 - row,
            displayCol: 7 - col
        };
    }
    return {
        displayRow: row,
        displayCol: col
    };
}

// Helper function to get actual coordinates from display coordinates
function getActualCoordinates(displayRow, displayCol) {
    if (selectedSide === 1) {
        return {
            actualRow: 7 - displayRow,
            actualCol: 7 - displayCol
        };
    }
    return {
        actualRow: displayRow,
        actualCol: displayCol
    };
}

// Initialize the board
function initializeBoard() {
    gameBoard = [
        [{type: 'rook', color: 'black'}, {type: 'knight', color: 'black'}, {type: 'bishop', color: 'black'}, {type: 'queen', color: 'black'}, {type: 'king', color: 'black'}, {type: 'bishop', color: 'black'}, {type: 'knight', color: 'black'}, {type: 'rook', color: 'black'}],
        [{type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}, {type: 'pawn', color: 'black'}],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [{type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}, {type: 'pawn', color: 'white'}],
        [{type: 'rook', color: 'white'}, {type: 'knight', color: 'white'}, {type: 'bishop', color: 'white'}, {type: 'queen', color: 'white'}, {type: 'king', color: 'white'}, {type: 'bishop', color: 'white'}, {type: 'knight', color: 'white'}, {type: 'rook', color: 'white'}]
    ];
    
    castlingRights = {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true }
    };
    kingMoved = { white: false, black: false };
    rookMoved = {
        white: { kingside: false, queenside: false },
        black: { kingside: false, queenside: false }
    };
    enPassantTarget = null;
}

// Get piece color
function getPieceColor(row, col) {
    if (gameBoard[row][col] === null) return null;
    return gameBoard[row][col].color;
}

// Get piece type
function getPieceType(row, col) {
    if (gameBoard[row][col] === null) return null;
    return gameBoard[row][col].type;
}

// Create the visual board
function createBoard() {
    const board = document.getElementById('chessBoard');
    board.innerHTML = '';
    
    for (let displayRow = 0; displayRow < 8; displayRow++) {
        for (let displayCol = 0; displayCol < 8; displayCol++) {
            const { actualRow, actualCol } = getActualCoordinates(displayRow, displayCol);
            
            const square = document.createElement('div');
            square.className = `square ${(displayRow + displayCol) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = actualRow;
            square.dataset.col = actualCol;
            square.onclick = () => handleSquareClick(actualRow, actualCol);
            
            const piece = gameBoard[actualRow][actualCol];
            if (piece) {
                square.textContent = pieces[piece.color][piece.type];
            }
            
            board.appendChild(square);
        }
    }
}

// Handle square clicks
function handleSquareClick(row, col) {
    if (gameOver) return;
    
    // In multiplayer, only allow moves on your turn
    if (isMultiplayer && playerSide !== currentPlayer) {
        updateGameStatus("Wait for your turn!");
        setTimeout(() => updateGameStatus(), 1500);
        return;
    }

    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    
    if (selectedSquare) {
        const [selectedRow, selectedCol] = selectedSquare;
        
        if (row === selectedRow && col === selectedCol) {
            clearSelection();
            return;
        }
        
        // Try to make a move
        if (isValidMove(selectedRow, selectedCol, row, col)) {
            if (isMultiplayer) {
                // Send move to server
                socket.emit('make-move', {
                    gameId: gameId,
                    fromRow: selectedRow,
                    fromCol: selectedCol,
                    toRow: row,
                    toCol: col
                });
                clearSelection();
            } else {
                // Single-player move
                makeMove(selectedRow, selectedCol, row, col);
                clearSelection();
                
                if (gameOver) {
                    document.getElementById('gameStatus').textContent = `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} Wins!`;
                    document.getElementById('gameStatus').className = 'status checkmate';
                    return;
                }
                
                switchPlayer();
                updateGameStatus();
            }
        } else {
            // Select new piece if it belongs to current player
            const pieceColor = getPieceColor(row, col);
            if (pieceColor === currentPlayer) {
                // In multiplayer, only allow selecting your own pieces
                if (!isMultiplayer || pieceColor === playerSide) {
                    selectSquare(row, col);
                } else {
                    clearSelection();
                }
            } else {
                clearSelection();
            }
        }
    } else {
        // Select square if it has a piece of the current player
        const pieceColor = getPieceColor(row, col);
        if (pieceColor === currentPlayer) {
            // In multiplayer, only allow selecting your own pieces
            if (!isMultiplayer || pieceColor === playerSide) {
                selectSquare(row, col);
            }
        }
    }
}

// Select a square and show possible moves
function selectSquare(row, col) {
    clearSelection();
    selectedSquare = [row, col];
    
    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    square.classList.add('selected');
    
    showPossibleMoves(row, col);
}

// Clear selection and possible moves
function clearSelection() {
    selectedSquare = null;
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('selected', 'possible-move', 'possible-capture');
    });
}

// Show possible moves for a piece
function showPossibleMoves(row, col) {
    const piece = gameBoard[row][col];
    const color = piece.color;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMove(row, col, r, c)) {
                const targetSquare = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (gameBoard[r][c] && gameBoard[r][c].color !== color) {
                    targetSquare.classList.add('possible-capture');
                } else {
                    targetSquare.classList.add('possible-move');
                }
            }
        }
    }
}

// Validate moves
function isValidMove(fromRow, fromCol, toRow, toCol) {
    if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
    
    const piece = gameBoard[fromRow][fromCol];
    const targetPiece = gameBoard[toRow][toCol];
    
    if (!piece) return false;
    
    const pieceColor = piece.color;
    const pieceType = piece.type;
    
    // Can't capture own pieces
    if (targetPiece && targetPiece.color === pieceColor) return false;
    
    // Check for castling
    if (pieceType === 'king' && Math.abs(toCol - fromCol) === 2) {
        if(toRow === fromRow) return isValidCastling(fromRow, fromCol, toCol);
        else return false;
    }
    
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);
    
    switch (pieceType) {
        case 'pawn':
            return isValidPawnMove(fromRow, fromCol, toRow, toCol, pieceColor);
        case 'rook':
            return (rowDiff === 0 || colDiff === 0) && isPathClear(fromRow, fromCol, toRow, toCol);
        case 'bishop':
            return absRowDiff === absColDiff && isPathClear(fromRow, fromCol, toRow, toCol);
        case 'queen':
            return ((rowDiff === 0 || colDiff === 0) || (absRowDiff === absColDiff)) && isPathClear(fromRow, fromCol, toRow, toCol);
        case 'king':
            return absRowDiff <= 1 && absColDiff <= 1;
        case 'knight':
            return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
    }
    
    return false;
}

// Validate castling
function isValidCastling(fromRow, fromCol, toCol) {
    const color = gameBoard[fromRow][fromCol].color;
    
    if (kingMoved[color]) return false;
    
    const isKingside = toCol > fromCol;
    const rookCol = isKingside ? 7 : 0;
    
    if (rookMoved[color][isKingside ? 'kingside' : 'queenside']) return false;
    
    const startCol = Math.min(fromCol, rookCol);
    const endCol = Math.max(fromCol, rookCol);
    for (let col = startCol + 1; col < endCol; col++) {
        if (gameBoard[fromRow][col] !== null) return false;
    }
    
    return true;
}

// Validate pawn moves
function isValidPawnMove(fromRow, fromCol, toRow, toCol, color) {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    const rowDiff = toRow - fromRow;
    const colDiff = Math.abs(toCol - fromCol);
    
    if (colDiff === 0 && !gameBoard[toRow][toCol]) {
        if (rowDiff === direction) return true;
        if (fromRow === startRow && rowDiff === 2 * direction && isPathClear(fromRow, fromCol, toRow, toCol)) return true;
    }
    
    if (colDiff === 1 && rowDiff === direction && gameBoard[toRow][toCol]) {
        return gameBoard[toRow][toCol].color !== color;
    }
    
    if (colDiff === 1 && rowDiff === direction && !gameBoard[toRow][toCol]) {
        if (enPassantTarget && enPassantTarget.row === toRow && enPassantTarget.col === toCol) {
            return true;
        }
    }
    
    return false;
}

// Check if path is clear for sliding pieces
function isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
        if (gameBoard[currentRow][currentCol] !== null) return false;
        currentRow += rowStep;
        currentCol += colStep;
    }
    
    return true;
}

// Make a move (for single-player only)
function makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = gameBoard[fromRow][fromCol];
    const isKing = piece.type === 'king';
    const isRook = piece.type === 'rook';
    const isPawn = piece.type === 'pawn';
    
    // Check if capturing a king - game over
    const targetPiece = gameBoard[toRow][toCol];
    if (targetPiece && targetPiece.type === 'king') {
        gameOver = true;
    }
    
    // Handle castling
    if (isKing && Math.abs(toCol - fromCol) === 2) {
        const isKingside = toCol > fromCol;
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? 5 : 3;
        
        gameBoard[fromRow][rookToCol] = gameBoard[fromRow][rookFromCol];
        gameBoard[fromRow][rookFromCol] = null;
        checkAndDestroyPieceInFront(fromRow, rookToCol);
    }
    
    // Handle en passant capture
    if (isPawn && enPassantTarget && toRow === enPassantTarget.row && toCol === enPassantTarget.col) {
        const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
        gameBoard[capturedPawnRow][toCol] = null;
    }
    
    // Update castling rights
    if (isKing) {
        kingMoved[piece.color] = true;
    }
    
    if (isRook) {
        if (fromCol === 0) {
            rookMoved[piece.color].queenside = true;
        } else if (fromCol === 7) {
            rookMoved[piece.color].kingside = true;
        }
    }
    
    if (targetPiece && targetPiece.type === 'rook') {
        if (toCol === 0) {
            rookMoved[targetPiece.color].queenside = true;
        } else if (toCol === 7) {
            rookMoved[targetPiece.color].kingside = true;
        }
    }
    
    // Set en passant target for next turn
    enPassantTarget = null;
    if (isPawn && Math.abs(toRow - fromRow) === 2) {
        const targetRow = fromRow + (toRow - fromRow) / 2;
        enPassantTarget = { row: targetRow, col: fromCol };
    }
    
    // Make the move
    gameBoard[toRow][toCol] = gameBoard[fromRow][fromCol];
    gameBoard[fromRow][fromCol] = null;
    
    // Handle pawn promotion
    if (isPawn && ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7))) {
        promotePawn(toRow, toCol);
    }
    
    checkAndDestroyPieceInFront(toRow, toCol);
    createBoard();
}

// Handle pawn promotion
function promotePawn(row, col) {
    const piece = gameBoard[row][col];
    const color = piece.color;
    gameBoard[row][col] = { type: 'queen', color: color };
}

// Check if there's an enemy piece in front of the moved piece and destroy it
function checkAndDestroyPieceInFront(row, col) {
    const piece = gameBoard[row][col];
    if (!piece) return;
    
    const direction = piece.color === 'white' ? -1 : 1;
    const frontRow = row + direction;
    
    if (frontRow < 0 || frontRow >= 8) return;
    
    const frontPiece = gameBoard[frontRow][col];
    if (frontPiece && frontPiece.color !== piece.color) {
        if (frontPiece.type === 'king') {
            gameOver = true;
        }
        gameBoard[frontRow][col] = null;
    }
}

// Switch players
function switchPlayer() {
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    document.getElementById('currentPlayer').textContent =
        currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
}

// Find king position
function findKing(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameBoard[row][col];
            if (piece && piece.type === 'king' && piece.color === color) {
                return [row, col];
            }
        }
    }
    return null;
}

// Update game status
function updateGameStatus(customMessage = null) {
    const statusElement = document.getElementById('gameStatus');
    const currentPlayerElement = document.getElementById('currentPlayer');
    
    if (customMessage) {
        statusElement.innerHTML = customMessage;
        statusElement.className = 'status';
        return;
    }
    
    if (gameOver) {
        return; // Status already set
    }
    
    if (isMultiplayer) {
        const isYourTurn = currentPlayer === playerSide;
        const turnText = isYourTurn ? 'Your turn' : "Opponent's turn";
        statusElement.textContent = `${turnText} - ${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} to move`;
        
        // Update visual indicators
        const currentPlayerDiv = document.querySelector('.current-player');
        if (currentPlayerDiv) {
            currentPlayerDiv.className = `current-player ${isYourTurn ? 'your-turn' : 'opponent-turn'}`;
        }
    } else {
        statusElement.textContent = 'Game in Progress';
    }
    statusElement.className = 'status';
}

// Reset the game
function resetGame() {
    if (isMultiplayer) {
        updateGameStatus('Cannot reset during multiplayer game');
        setTimeout(() => updateGameStatus(), 2000);
        return;
    }
    
    currentPlayer = 'white';
    selectedSquare = null;
    gameOver = false;
    enPassantTarget = null;
    document.getElementById('currentPlayer').textContent = 'White';
    document.getElementById('gameStatus').textContent = 'Game in Progress';
    document.getElementById('gameStatus').className = 'status';
    initializeBoard();
    createBoard();
}

// Add multiplayer controls
function addMultiplayerControls() {
    if (!isMultiplayer) return;
    
    const controlsDiv = document.querySelector('.controls');
    if (controlsDiv) {
        // Clear existing controls and replace with multiplayer controls
        controlsDiv.innerHTML = '';
        controlsDiv.className = 'controls multiplayer-controls';
        
        const findGameButton = document.createElement('button');
        findGameButton.textContent = 'Find New Game';
        findGameButton.onclick = () => {
            if (socket) {
                gameOver = false;
                selectedSquare = null;
                clearSelection();
                socket.emit('find-game');
                updateGameStatus('<span class="waiting-animation">Looking for opponent...</span>');
                removePlayerSideIndicator();
            }
        };
        controlsDiv.appendChild(findGameButton);
        
        const backButton = document.createElement('button');
        backButton.textContent = 'Back to Menu';
        backButton.onclick = () => {
            if (socket) {
                socket.disconnect();
            }
            window.location.href = 'index.html';
        };
        controlsDiv.appendChild(backButton);
    }
}

// Add connection status indicator
function addConnectionStatus() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connectionStatus';
    statusDiv.className = 'connection-status disconnected';
    statusDiv.textContent = 'Connecting...';
    document.body.appendChild(statusDiv);
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        statusDiv.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        statusDiv.textContent = connected ? 'Connected' : 'Disconnected';
    }
}

// Add player side indicator
function addPlayerSideIndicator() {
    if (!isMultiplayer || !playerSide) return;
    
    // Remove existing indicator
    removePlayerSideIndicator();
    
    const gameInfo = document.querySelector('.game-info');
    if (gameInfo) {
        const indicator = document.createElement('div');
        indicator.id = 'playerSideIndicator';
        indicator.className = 'multiplayer-info';
        indicator.innerHTML = `
            You are playing as: 
            <span class="player-side-indicator player-side-${playerSide}">
                ${pieces[playerSide][playerSide === 'white' ? 'king' : 'king']} ${playerSide.toUpperCase()}
            </span>
        `;
        gameInfo.appendChild(indicator);
    }
}

// Remove player side indicator
function removePlayerSideIndicator() {
    const indicator = document.getElementById('playerSideIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Initialize the game
function initGame() {
    initializeSelectedSide();
    
    // Check if this is multiplayer mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('multiplayer') === 'true') {
        if (initializeMultiplayer()) {
            // Start looking for a game immediately
            socket.emit('find-game');
            updateGameStatus('Looking for opponent...');
        }
    }
    
    initializeBoard();
    createBoard();
    updateGameStatus();
    
    // Add multiplayer controls if needed
    setTimeout(() => {
        addMultiplayerControls();
    }, 100);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('chessBoard')) {
        // We're on the game page
        initGame();
    } else {
        // We're on the home page - add the multiplayer button
        addMultiplayerButton();
    }
});

// Add multiplayer button to home page
function addMultiplayerButton() {
    const playButton = document.getElementById('playButton');
    
    if (playButton) {
        // Update the existing button text
        playButton.textContent = '⚔️ Play Solo ⚔️';
        
        // Create multiplayer button
        const multiplayerButton = document.createElement('button');
        multiplayerButton.className = 'play-button';
        multiplayerButton.style.marginTop = '15px';
        multiplayerButton.textContent = '🌐 Play Online 🌐';
        multiplayerButton.onclick = () => {
            window.location.href = 'bonk chess.html?multiplayer=true';
        };
        
        // Insert the multiplayer button after the play button
        playButton.parentNode.insertBefore(multiplayerButton, playButton.nextSibling);
    }
}