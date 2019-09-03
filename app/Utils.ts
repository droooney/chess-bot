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
  wasDoubleCheck: boolean;
  prevCheckingPiece: Piece | null;
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
  static squareRanks: number[] = Utils.allSquares.map((square) => square >> 3);
  static squareFiles: number[] = Utils.allSquares.map((square) => square & 7);
  static diagonalMoves: number[][][] = Utils.allSquares.map((square) => [
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
  static kingMoves: number[][] = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, +1, +1, true),
    Utils.traverseDirection(square, +1, -1, true),
    Utils.traverseDirection(square, -1, +1, true),
    Utils.traverseDirection(square, -1, -1, true),
    Utils.traverseDirection(square, 0, +1, true),
    Utils.traverseDirection(square, 0, -1, true),
    Utils.traverseDirection(square, +1, 0, true),
    Utils.traverseDirection(square, -1, 0, true)
  ].flat());
  static kingAttacksMap: { [square in number]: boolean; }[] = Utils.kingMoves.map((attacks) => (
    Utils.arrayToMap(attacks, () => true)
  ));
  static slidingAttacks: { [type in PieceType.BISHOP | PieceType.ROOK | PieceType.QUEEN]: { [square in number]: number[][]; }; } = {
    [PieceType.QUEEN]: Utils.allSquares.map((square) => [
      ...Utils.diagonalMoves[square],
      ...Utils.orthogonalMoves[square]
    ]),
    [PieceType.ROOK]: Utils.allSquares.map((square) => Utils.orthogonalMoves[square]),
    [PieceType.BISHOP]: Utils.allSquares.map((square) => Utils.diagonalMoves[square])
  };
  static knightMoves: number[][] = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, +2, +1, true),
    Utils.traverseDirection(square, +2, -1, true),
    Utils.traverseDirection(square, -2, +1, true),
    Utils.traverseDirection(square, -2, -1, true),
    Utils.traverseDirection(square, +1, +2, true),
    Utils.traverseDirection(square, +1, -2, true),
    Utils.traverseDirection(square, -1, +2, true),
    Utils.traverseDirection(square, -1, -2, true)
  ].flat());
  static knightAttacksMap: { [square in number]: boolean; }[] = Utils.knightMoves.map((attacks) => (
    Utils.arrayToMap(attacks, () => true)
  ));
  static pawnAdvanceMoves: { [color in Color]: number[][]; } = [
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
  static pawnDoubleAdvanceMoves: { [color in Color]: (number | null)[]; } = [
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
  static pawnEnPassantSquaresMap: { [square in number]: number; } = Utils.arrayToMap([
    ...Utils.squares[1],
    ...Utils.squares[6]
  ], (square) => {
    const x = square & 7;
    const y = square >> 3;

    return y === 1
      ? Utils.squares[y + 1][x]
      : Utils.squares[y - 1][x];
  });
  static pawnEnPassantSquares: { [square in number]: boolean; } = Utils.arrayToMap([
    ...Utils.squares[2],
    ...Utils.squares[5]
  ], () => true);
  static pawnEnPassantPieceSquares: { [square in number]: number; } = _.mapValues(Utils.pawnEnPassantSquares, (_v, square) => (
    (+square >> 3) === 2
      ? +square + 8
      : +square - 8
  ));
  static pawnEnPassantOpponentPawnSquares: { [square in number]: [number, number]; } = Utils.arrayToMap([
    ...Utils.squares[3],
    ...Utils.squares[4]
  ], (square) => (
    (square & 7) === 0
      ? [-1, square + 1]
      : (square & 7) === 7
        ? [square - 1, -1]
        : [square - 1, square + 1]
  ));
  static pawnAttacks: { [color in Color]: number[][]; } = [
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
  static pawnAttacksMap: { [color in Color]: { [square in number]: boolean; }[]; } = _.mapValues(Utils.pawnAttacks, (colorAttacks) => (
    colorAttacks.map((attacks) => (
      Utils.arrayToMap(attacks, () => true)
    ))
  ));
  static promotionSquares: { [type in Color]: { [square in number]: boolean; }; } = [
    Utils.arrayToMap(Utils.allSquares.slice(56), () => true),
    Utils.arrayToMap(Utils.allSquares.slice(0, 8), () => true)
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
  static rookCastlingPermissions: { [rookSquare in number]: Castling; } = {
    [Utils.squares[0][0]]: Castling.WHITE_QUEEN_SIDE,
    [Utils.squares[7][0]]: Castling.BLACK_QUEEN_SIDE,
    [Utils.squares[0][7]]: Castling.WHITE_KING_SIDE,
    [Utils.squares[7][7]]: Castling.BLACK_KING_SIDE
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
  static distances: number[][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => (
      Math.abs((square1 >> 3) - (square2 >> 3))
      + Math.abs((square1 & 7) - (square2 & 7))
    ))
  ));
  static isAlignedOrthogonally: boolean[][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => (
      (square1 >> 3) === (square2 >> 3)
      || (square1 & 7) === (square2 & 7)
    ))
  ));
  static isAlignedDiagonally: boolean[][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => (
      Math.abs((square1 >> 3) - (square2 >> 3))
      === Math.abs((square1 & 7) - (square2 & 7))
    ))
  ));
  static middleSquares: number[][][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => {
      if (
        !Utils.isAlignedOrthogonally[square1][square2]
        && !Utils.isAlignedDiagonally[square1][square2]
      ) {
        return [];
      }

      const middleSquares: number[] = [];
      const incrementX = Math.sign((square2 & 7) - (square1 & 7));
      const incrementY = Math.sign((square2 >> 3) - (square1 >> 3));
      let square = square1;

      while (true) {
        square = (square >> 3) + incrementY << 3 | (square & 7) + incrementX;

        if (square === square2) {
          break;
        }

        middleSquares.push(square);
      }

      return middleSquares;
    })
  ));
  static middleSquaresMap: { [square in number]: boolean }[][] = Utils.middleSquares.map((middleSquares) => (
    middleSquares.map((middleSquares) => Utils.arrayToMap(middleSquares, () => true))
  ));
  static behindSquares: number[][][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => {
      if (
        square1 === square2
        || (
          !Utils.isAlignedOrthogonally[square1][square2]
          && !Utils.isAlignedDiagonally[square1][square2]
        )
      ) {
        return [];
      }

      const incrementX = Math.sign((square1 & 7) - (square2 & 7));
      const incrementY = Math.sign((square1 >> 3) - (square2 >> 3));

      return Utils.traverseDirection(square1, incrementX, incrementY, false);
    })
  ));
  static directions = {
    UP: [1, -1],
    DOWN: [-1, 1]
  };
  static colors: number[] = Utils.allSquares.map((square) => square >> 3 & 1 ^ square & 1);
  static sliders = {
    [PieceType.BISHOP]: true,
    [PieceType.ROOK]: true,
    [PieceType.QUEEN]: true
  };
  static diagonalSliders = {
    [PieceType.BISHOP]: true,
    [PieceType.QUEEN]: true
  };
  static orthogonalSliders = {
    [PieceType.ROOK]: true,
    [PieceType.QUEEN]: true
  };

  static arrayToMap<T extends string | number, R>(array: T[], callback: (value: T) => R): { [key in T]: R; } {
    const map = {} as { [key in T]: R; };

    array.forEach((value) => {
      map[value] = callback(value);
    });

    return map;
  }

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

    if (nextY < 0 || nextY > 7 || nextX < 0 || nextX > 7) {
      return [];
    }

    const nextSquare = Utils.squares[nextY][nextX];

    if (stopAfter1) {
      return [nextSquare];
    }

    return [nextSquare, ...Utils.traverseDirection(nextSquare, incrementX, incrementY, false)];
  }
}
