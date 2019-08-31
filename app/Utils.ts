import * as _ from 'lodash';

export enum Color {
  WHITE,
  BLACK
}

export enum PieceType {
  KING,
  QUEEN,
  ROOK,
  BISHOP,
  KNIGHT,
  PAWN
}

export interface Move {
  move: number;
  changedPiece: Piece;
  changedPieceOldSquare: number;
  capturedPiece: Piece | null;
  promotedPawn: Piece | null;
  castlingRook: Piece | null;
  wasCheck: boolean;
  prevPosition: bigint;
  prevPossibleEnPassant: number | null;
  prevPossibleCastling: number;
  prevPliesWithoutCaptureOrPawnMove: number;
}

export interface Piece {
  id: number;
  type: PieceType;
  color: Color;
  square: number;
}

export type ColorPieces = { [id in number]: Piece; };

export enum CastlingSide {
  KING,
  QUEEN
}

export interface CastlingParams {
  rookSquare: number;
  newKingSquare: number;
  newRookSquare: number;
  middleSquares: number[];
}

export enum Castling {
  WHITE_KING_SIDE = 1,
  WHITE_QUEEN_SIDE = 2,
  BLACK_KING_SIDE = 4,
  BLACK_QUEEN_SIDE = 8
}

export enum Result {
  WHITE,
  BLACK,
  DRAW
}

export type Board = { [square in number]: Piece | null; };

export default class Utils {
  static oppositeColor: { [color in Color]: Color; } = [Color.BLACK, Color.WHITE];
  static pieceLiterals: { [color in Color]: string; } = ['KQRBNP', 'kqrbnp'];
  static piecesWorth: { [type in PieceType]: number; } = [1000, 16, 8, 5, 5, 1];
  static pieceFromLiteral: { [literal in string]: PieceType; } = {
    k: PieceType.KING,
    q: PieceType.QUEEN,
    r: PieceType.ROOK,
    b: PieceType.BISHOP,
    n: PieceType.KNIGHT,
    p: PieceType.PAWN
  };
  static squares: number[][] = new Array(8).fill(0).map((_v, y) => (
    new Array(8).fill(0).map((_v, x) => y << 3 | x)
  ));
  static allSquares: number[] = new Array(64).fill(0).map((_v, i) => i);
  static squareRanks: { [square in number]: number } = Utils.allSquares.map((square) => square >> 3);
  static squareFiles: { [square in number]: number } = Utils.allSquares.map((square) => square & 7);
  static diagonalMoves: { [square in number]: number[][]; } = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, +1, +1, false),
    Utils.traverseDirection(square, +1, -1, false),
    Utils.traverseDirection(square, -1, +1, false),
    Utils.traverseDirection(square, -1, -1, false)
  ].filter((moves) => moves.length));
  static orthogonalMoves: { [square in number]: number[][]; } = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, 0, +1, false),
    Utils.traverseDirection(square, 0, -1, false),
    Utils.traverseDirection(square, +1, 0, false),
    Utils.traverseDirection(square, -1, 0, false)
  ].filter((moves) => moves.length));
  static kingMoves: { [square in number]: number[]; } = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, +1, +1, true),
    Utils.traverseDirection(square, +1, -1, true),
    Utils.traverseDirection(square, -1, +1, true),
    Utils.traverseDirection(square, -1, -1, true),
    Utils.traverseDirection(square, 0, +1, true),
    Utils.traverseDirection(square, 0, -1, true),
    Utils.traverseDirection(square, +1, 0, true),
    Utils.traverseDirection(square, -1, 0, true)
  ].flat());
  static slidingAttacks: { [type in PieceType.BISHOP | PieceType.ROOK | PieceType.QUEEN]: { [square in number]: number[][]; }; } = {
    [PieceType.QUEEN]: Utils.allSquares.map((square) => [
      ...Utils.diagonalMoves[square],
      ...Utils.orthogonalMoves[square]
    ]),
    [PieceType.ROOK]: Utils.allSquares.map((square) => Utils.orthogonalMoves[square]),
    [PieceType.BISHOP]: Utils.allSquares.map((square) => Utils.diagonalMoves[square])
  };
  static knightMoves: { [square in number]: number[]; } = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, +2, +1, true),
    Utils.traverseDirection(square, +2, -1, true),
    Utils.traverseDirection(square, -2, +1, true),
    Utils.traverseDirection(square, -2, -1, true),
    Utils.traverseDirection(square, +1, +2, true),
    Utils.traverseDirection(square, +1, -2, true),
    Utils.traverseDirection(square, -1, +2, true),
    Utils.traverseDirection(square, -1, -2, true)
  ].flat());
  static pawnAdvanceMoves: { [color in Color]: { [square in number]: number[]; }; } = [
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 0 || y === 7
        ? []
        : y === 1
          ? [Utils.squares[y + 1][x], Utils.squares[y + 2][x]]
          : [Utils.squares[y + 1][x]];
    }),
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 0 || y === 7
        ? []
        : y === 6
          ? [Utils.squares[y - 1][x], Utils.squares[y - 2][x]]
          : [Utils.squares[y - 1][x]];
    })
  ];
  static pawnDoubleAdvanceMoves: { [color in Color]: { [square in number]: number | null; }; } = [
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 1
        ? Utils.squares[y + 2][x]
        : null;
    }),
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 6
        ? Utils.squares[y - 2][x]
        : null;
    })
  ];
  static pawnEnPassantSquaresMap: { [square in number]: number; } = [
    ...Utils.squares[1],
    ...Utils.squares[6]
  ].reduce((squares, square) => {
    const x = square & 7;
    const y = square >> 3;

    return {
      ...squares,
      [square]: y === 1
        ? Utils.squares[y + 1][x]
        : Utils.squares[y - 1][x]
    };
  }, {} as { [square in number]: number; });
  static pawnEnPassantSquares: { [square in number]: true; } = [
    ...Utils.squares[2],
    ...Utils.squares[5]
  ].reduce((squares, square) => ({
    ...squares,
    [square]: true
  }), {} as { [square in number]: true; });
  static pawnEnPassantPieceSquares: { [square in number]: number; } = _.mapValues(Utils.pawnEnPassantSquares, (_v, square) => (
    (+square >> 3) === 2
      ? +square + 8
      : +square - 8
  ));
  static pawnEnPassantOpponentPawnSquares: { [square in number]: [number, number]; } = [
    ...Utils.squares[3],
    ...Utils.squares[4]
  ].reduce((squares, square) => {
    squares[square] = (square & 7) === 0
      ? [0, square + 1]
      : (square & 7) === 7
        ? [square - 1, 0]
        : [square - 1, square + 1];

    return squares;
  }, {} as { [square in number]: [number, number]; });
  static pawnCaptureMoves: { [color in Color]: { [square in number]: number[]; }; } = [
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 0 || y === 7
        ? []
        : [Utils.squares[y + 1][x + 1], Utils.squares[y + 1][x - 1]].filter((square) => square !== undefined);
    }),
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 0 || y === 7
        ? []
        : [Utils.squares[y - 1][x + 1], Utils.squares[y - 1][x - 1]].filter((square) => square !== undefined);
    })
  ];
  static promotionSquares: { [type in Color]: { [square in number]: true; }; } = [
    Utils.allSquares.slice(56).reduce((squares, square) => ({ ...squares, [square]: true }), {}),
    Utils.allSquares.slice(0, 8).reduce((squares, square) => ({ ...squares, [square]: true }), {})
  ];
  static castling: { [color in Color]: { [castlingSide in CastlingSide]: Castling; }; } = [
    [Castling.WHITE_KING_SIDE, Castling.WHITE_QUEEN_SIDE],
    [Castling.BLACK_KING_SIDE, Castling.BLACK_QUEEN_SIDE]
  ];
  static fenCastling: { [side in string]: Castling; } = {
    K: Castling.WHITE_KING_SIDE,
    Q: Castling.WHITE_QUEEN_SIDE,
    k: Castling.BLACK_KING_SIDE,
    q: Castling.BLACK_QUEEN_SIDE
  };
  static rookCastlingSides: { [rookSquare in number]: CastlingSide; } = {
    [Utils.squares[0][0]]: CastlingSide.QUEEN,
    [Utils.squares[7][0]]: CastlingSide.QUEEN,
    [Utils.squares[0][7]]: CastlingSide.KING,
    [Utils.squares[7][7]]: CastlingSide.KING
  };
  static kingCastlingSides: { [kingSquare in number]: CastlingSide; } = {
    [Utils.squares[0][2]]: CastlingSide.QUEEN,
    [Utils.squares[7][2]]: CastlingSide.QUEEN,
    [Utils.squares[0][6]]: CastlingSide.KING,
    [Utils.squares[7][6]]: CastlingSide.KING
  };
  static castlingParams: { [color in Color]: { [castlingSide in CastlingSide]: CastlingParams; }; } = [
    [
      {
        rookSquare: Utils.squares[0][7],
        newKingSquare: Utils.squares[0][6],
        newRookSquare: Utils.squares[0][5],
        middleSquares: [
          Utils.squares[0][5],
          Utils.squares[0][6]
        ]
      },
      {
        rookSquare: Utils.squares[0][0],
        newKingSquare: Utils.squares[0][2],
        newRookSquare: Utils.squares[0][3],
        middleSquares: [
          Utils.squares[0][1],
          Utils.squares[0][2],
          Utils.squares[0][3]
        ]
      }
    ],
    [
      {
        rookSquare: Utils.squares[7][7],
        newKingSquare: Utils.squares[7][6],
        newRookSquare: Utils.squares[7][5],
        middleSquares: [
          Utils.squares[7][5],
          Utils.squares[7][6]
        ]
      },
      {
        rookSquare: Utils.squares[7][0],
        newKingSquare: Utils.squares[7][2],
        newRookSquare: Utils.squares[7][3],
        middleSquares: [
          Utils.squares[7][1],
          Utils.squares[7][2],
          Utils.squares[7][3]
        ]
      }
    ]
  ];
  static kingInitialSquares: { [color in Color]: number; } = [Utils.squares[0][4], Utils.squares[7][4]];
  static rookInitialSquares: { [square in number]: number; } = {
    [Utils.squares[0][3]]: Utils.squares[0][0],
    [Utils.squares[7][3]]: Utils.squares[7][0],
    [Utils.squares[0][5]]: Utils.squares[0][7],
    [Utils.squares[7][5]]: Utils.squares[7][7]
  };
  static ranks = {
    RANK_1: [0, 7],
    RANK_2: [1, 6],
    RANK_3: [2, 5],
    RANK_4: [3, 4],
    RANK_5: [4, 3],
    RANK_6: [5, 2],
    RANK_7: [6, 1],
    RANK_8: [7, 0]
  };
  static files = {
    FILE_A: 0,
    FILE_B: 1,
    FILE_C: 2,
    FILE_D: 3,
    FILE_E: 4,
    FILE_F: 5,
    FILE_G: 6,
    FILE_H: 7
  };
  static distances: { [square in number]: { [square in number]: number } } = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => (
      Math.abs((square1 >> 3) - (square2 >> 3))
      + Math.abs((square1 & 7) - (square2 & 7))
    ))
  ));
  static directions = {
    UP: [1, -1],
    DOWN: [-1, 1]
  };
  static colors = Utils.allSquares.map((square) => square >> 3 & 1 ^ square & 1);

  static uciToMove(uci: string): number {
    const [fromX, fromY, toX, toY, promotion] = uci;
    const fromSquare = Utils.literalToSquare(fromX + fromY);
    const toSquare = Utils.literalToSquare(toX + toY);
    let move = fromSquare << 9 | toSquare << 3;

    if (promotion) {
      move |= Utils.pieceFromLiteral[promotion];
    }

    return move;
  }

  static literalToSquare(squareString: string): number {
    return (+squareString[1] - 1) << 3 | (squareString.charCodeAt(0) - 97);
  }

  static squareToLiteral(square: number): string {
    return `${String.fromCharCode((square & 7) + 97)}${(square >> 3) + 1}`;
  }

  static moveToUci(move: number): string {
    const from = Utils.squareToLiteral(move >> 9);
    const to = Utils.squareToLiteral(move >> 3 & 63);
    const promotion = move & 7
      ? Utils.pieceLiterals[Color.BLACK][move & 7]
      : '';

    return from + to + promotion;
  }

  static traverseDirection(square: number, incrementX: number, incrementY: number, stopAfter1: boolean): number[] {
    const nextX = (square & 7) + incrementX;
    const nextY = (square >> 3) + incrementY;

    if (nextY < 0 || nextY > 7) {
      return [];
    }

    const nextSquare = Utils.squares[nextY][nextX];

    if (nextSquare === undefined) {
      return [];
    }

    if (stopAfter1) {
      return [nextSquare];
    }

    return [nextSquare, ...Utils.traverseDirection(nextSquare, incrementX, incrementY, false)];
  }
}
