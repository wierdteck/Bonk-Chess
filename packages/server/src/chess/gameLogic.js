const PAWN = "p";
const ROOK = "r";
const KNIGHT = "n";
const BISHOP = "b";
const QUEEN = "q";
const KING = "k";

// Helper: check if coordinates are on board
function onBoard(x, y) {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

// Check if path is clear for sliding pieces (rook, bishop, queen)
function isPathClear(board, from, to) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const dx = tx - fx;
  const dy = ty - fy;
  const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
  const stepY = dy === 0 ? 0 : dy / Math.abs(dy);

  let x = fx + stepX;
  let y = fy + stepY;

  while (x !== tx || y !== ty) {
    if (board[x][y]) return false;
    x += stepX;
    y += stepY;
  }
  return true;
}

// Check if a move is legal (basic, including castling & en passant)
function isLegalMove(game, from, to) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const piece = game.board[fx][fy];
  const target = game.board[tx][ty];

  if (!piece) return false;
  if (piece.color !== game.currentTurn) return false;
  if (target && target.color === piece.color) return false;

  const dx = tx - fx;
  const dy = ty - fy;

  switch (piece.type) {
    case PAWN:
      const dir = piece.color === "white" ? -1 : 1;

      // Normal forward
      if (dx === dir && dy === 0 && !target) return true;

      // Double move from starting rank
      if (dx === 2 * dir && dy === 0 && !target &&
          ((piece.color === "white" && fx === 6) || (piece.color === "black" && fx === 1)) &&
          !game.board[fx + dir][fy]) return true;

      // Capture
      if (dx === dir && Math.abs(dy) === 1 && target) return true;

      // En passant
      if (dx === dir && Math.abs(dy) === 1 && !target) {
        const enPassantTarget = game.enPassantTarget;
        if (enPassantTarget && enPassantTarget[0] === tx && enPassantTarget[1] === ty) return true;
      }

      return false;

    case ROOK:
      return (dx === 0 || dy === 0) && isPathClear(game.board, from, to);

    case KNIGHT:
      return (Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2);

    case BISHOP:
      return Math.abs(dx) === Math.abs(dy) && isPathClear(game.board, from, to);

    case QUEEN:
      return (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && isPathClear(game.board, from, to);

    case KING:
      // Normal king move
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return true;

      // Castling
      if (!piece.hasMoved && dx === 0 && Math.abs(dy) === 2) {
        const row = fx;
        // Kingside
        if (dy === 2) {
          const rook = game.board[row][7];
          if (rook && rook.type === ROOK && !rook.hasMoved &&
              !game.board[row][5] && !game.board[row][6]) return true;
        }
        // Queenside
        if (dy === -2) {
          const rook = game.board[row][0];
          if (rook && rook.type === ROOK && !rook.hasMoved &&
              !game.board[row][1] && !game.board[row][2] && !game.board[row][3]) return true;
        }
      }

      return false;

    default:
      return false;
  }
}

export function applyMove(game, move) {
  let isWin = 0;
  const { from, to } = move;
  const [fx, fy] = from;
  const [tx, ty] = to;
  const piece = game.board[fx][fy];
  if (!piece) return { error: "No piece at source" };
  if (!isLegalMove(game, from, to)) return { error: "Illegal move" };

  const dx = tx - fx;
  const dy = ty - fy;

  // En passant capture
  if (piece.type === PAWN && Math.abs(dy) === 1 && !game.board[tx][ty]) {
    if (game.enPassantTarget && game.enPassantTarget[0] === tx && game.enPassantTarget[1] === ty) {
      game.board[fx][ty] = null; // remove captured pawn
    }
  }

  // Castling move
  if (piece.type === KING && Math.abs(dy) === 2) {
    const row = fx;
    let rook, rookFromCol, rookToCol;
    if (dy === 2) { // kingside
      rookFromCol = 7;
      rookToCol = 5;
    }
    if (dy === -2) { // queenside
      rookFromCol = 0;
      rookToCol = 3;
    }

    rook = game.board[row][rookFromCol];
    game.board[row][rookToCol] = rook;
    game.board[row][rookFromCol] = null;
    rook.hasMoved = true;

    // Capture enemy piece in front of rook after castling
    const rookDirection = rook.color === "white" ? -1 : 1;
    const frontRow = row + rookDirection;
    const frontCol = rookToCol;
    if (frontRow >= 0 && frontRow < game.board.length) {
      const frontPiece = game.board[frontRow][frontCol];
      if (frontPiece && frontPiece.color !== rook.color) {
        if (frontPiece.type === "k") isWin = 2;
        game.board[frontRow][frontCol] = null;
      }
    }
  }

  const targetPiece = game.board[tx][ty];
  if (targetPiece && targetPiece.type === "k" && targetPiece.color !== piece.color) {
    isWin = 1;
  }

  // Move piece
  game.board[tx][ty] = piece;
  game.board[fx][fy] = null;

  // Mark piece as moved
  piece.hasMoved = true;

  // Pawn promotion
  if (piece.type === PAWN && (tx === 0 || tx === 7)) {
    game.board[tx][ty] = { type: QUEEN, color: piece.color, hasMoved: true };
  }

  // Update en passant target
  game.enPassantTarget = null;
  if (piece.type === PAWN && Math.abs(dx) === 2) {
    game.enPassantTarget = [fx + dx / 2, fy];
  }

  // Capture enemy piece in front of moved piece
  const direction = piece.color === "white" ? -1 : 1;
  const frontRow = tx + direction;
  const frontCol = ty;

  if (frontRow >= 0 && frontRow < game.board.length) {
    const frontPiece = game.board[frontRow][frontCol];
    if (frontPiece && frontPiece.color !== piece.color) {
      game.board[frontRow][frontCol] = null;
      if (frontPiece.type === "k") isWin = 2;
    }
  }

  // Switch turn
  game.currentTurn = game.currentTurn === "white" ? "black" : "white";

  return { board: game.board, turn: game.currentTurn, win: isWin};
}
