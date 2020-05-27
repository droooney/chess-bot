declare module '*.node' {
  export default class Bot {
    constructor(fen: string, color: 0 | 1, searchDepth: number);

    applyMoves(moves: string): void;
    destroy(): void;
    makeMove(): number | null;
  }
}
