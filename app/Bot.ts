import Game from './Game';
import { Color, PieceType } from './Utils';

export default class Bot extends Game {
  color: Color;

  constructor(color: Color) {
    super();

    this.color = color;
  }

  getAllLegalMoves(): number[] {
    const moves: number[] = [];
    const pieces = this.pieces[this.turn];

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const legalMoves = this.getLegalMoves(piece, false);

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        const square = legalMoves[i];
        const move = piece.square << 9 | square << 3;

        if (piece.type === PieceType.PAWN && square in Bot.promotionSquares[this.turn]) {
          moves.push(move | PieceType.QUEEN);
          moves.push(move | PieceType.KNIGHT);
          moves.push(move | PieceType.ROOK);
          moves.push(move | PieceType.BISHOP);
        } else {
          moves.push(move);
        }
      }
    }

    return moves;
  }

  getOptimalMove(): number {
    const allLegalMoves = this.getAllLegalMoves();

    return allLegalMoves[Math.floor(Math.random() * allLegalMoves.length)];
  }

  makeMove(): number | undefined {
    if (this.result || this.turn !== this.color) {
      return;
    }

    const time = Date.now();
    const move = this.getOptimalMove();

    console.log(`move took ${Date.now() - time} ms`);

    return move;
  }
}
