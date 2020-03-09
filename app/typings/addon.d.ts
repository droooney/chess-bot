declare module '*.node' {
  export default class Bot {
    constructor(fen: string, color: 0 | 1);

    applyMoves(moves: string): void;
    makeMove(): number | null;
  }
}
