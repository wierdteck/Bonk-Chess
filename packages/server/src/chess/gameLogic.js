export function applyMove(game, move) {
  const { from, to } = move;

  const [fx, fy] = from;
  const [tx, ty] = to;

  const piece = game.board[fx][fy];
  if (!piece) return { error: "No piece at source" };

  // Basic move (expand later)
  game.board[tx][ty] = piece;
  game.board[fx][fy] = null;

  game.currentTurn = game.currentTurn === "white" ? "black" : "white";
  return { board: game.board, turn: game.currentTurn };
}
