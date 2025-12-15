export function initializeBoard() {
  const emptyRow = Array(8).fill(null);

  const board = [];

  // Black pieces
  board.push([
    { type: "r", color: "black", hasMoved: false },
    { type: "n", color: "black", hasMoved: false },
    { type: "b", color: "black", hasMoved: false },
    { type: "q", color: "black", hasMoved: false },
    { type: "k", color: "black", hasMoved: false },
    { type: "b", color: "black", hasMoved: false },
    { type: "n", color: "black", hasMoved: false },
    { type: "r", color: "black", hasMoved: false },
  ]);

  // Black pawns
  board.push(Array(8).fill(null).map(() => ({ type: "p", color: "black", hasMoved: false })));

  // Empty rows
  board.push([...emptyRow]);
  board.push([...emptyRow]);
  board.push([...emptyRow]);
  board.push([...emptyRow]);

  // White pawns
  board.push(Array(8).fill(null).map(() => ({ type: "p", color: "white", hasMoved: false })));

  // White pieces
  board.push([
    { type: "r", color: "white", hasMoved: false },
    { type: "n", color: "white", hasMoved: false },
    { type: "b", color: "white", hasMoved: false },
    { type: "q", color: "white", hasMoved: false },
    { type: "k", color: "white", hasMoved: false },
    { type: "b", color: "white", hasMoved: false },
    { type: "n", color: "white", hasMoved: false },
    { type: "r", color: "white", hasMoved: false },
  ]);

  return board;
}
