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
  capturedPiece: Piece | null;
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

export interface CastlingParams2 {
  rookSquare: number;
  newKingSquare: bigint;
  newRookSquare: bigint;
  middleSquares: bigint;
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

export interface Attacks {
  mask: bigint;
  map: Map<bigint, bigint>;
}

export class Bitboards extends Array<bigint> {
  all: bigint = 0n;

  constructor() {
    super();

    this[PieceType.PAWN] = 0n;
    this[PieceType.KNIGHT] = 0n;
    this[PieceType.BISHOP] = 0n;
    this[PieceType.ROOK] = 0n;
    this[PieceType.QUEEN] = 0n;
    this[PieceType.KING] = 0n;
  }
}

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
  static squareBitboards: { [square in number]: bigint; } = Utils.allSquares.map((square) => 1n << BigInt(square));
  static diagonalMoves: { [square in number]: number[][]; } = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, +1, +1, false),
    Utils.traverseDirection(square, +1, -1, false),
    Utils.traverseDirection(square, -1, +1, false),
    Utils.traverseDirection(square, -1, -1, false)
  ]);
  static orthogonalMoves: { [square in number]: number[][]; } = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, 0, +1, false),
    Utils.traverseDirection(square, 0, -1, false),
    Utils.traverseDirection(square, +1, 0, false),
    Utils.traverseDirection(square, -1, 0, false)
  ]);
  static pieceMoves: { [type in Exclude<PieceType, PieceType.PAWN>]: { [square in number]: number[][]; }; } = [
    // king
    Utils.allSquares.map((square) => [
      Utils.traverseDirection(square, +1, +1, true),
      Utils.traverseDirection(square, +1, -1, true),
      Utils.traverseDirection(square, -1, +1, true),
      Utils.traverseDirection(square, -1, -1, true),
      Utils.traverseDirection(square, 0, +1, true),
      Utils.traverseDirection(square, 0, -1, true),
      Utils.traverseDirection(square, +1, 0, true),
      Utils.traverseDirection(square, -1, 0, true)
    ]),
    // queen
    Utils.allSquares.map((square) => [
      ...Utils.diagonalMoves[square],
      ...Utils.orthogonalMoves[square]
    ]),
    // rook
    Utils.allSquares.map((square) => Utils.orthogonalMoves[square]),
    // bishop
    Utils.allSquares.map((square) => Utils.diagonalMoves[square]),
    // knight
    Utils.allSquares.map((square) => [
      Utils.traverseDirection(square, +2, +1, true),
      Utils.traverseDirection(square, +2, -1, true),
      Utils.traverseDirection(square, -2, +1, true),
      Utils.traverseDirection(square, -2, -1, true),
      Utils.traverseDirection(square, +1, +2, true),
      Utils.traverseDirection(square, +1, -2, true),
      Utils.traverseDirection(square, -1, +2, true),
      Utils.traverseDirection(square, -1, -2, true)
    ])
  ];
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
  static castlingParams2: { [color in Color]: { [castlingSide in CastlingSide]: CastlingParams2; }; } = [
    [
      {
        rookSquare: Utils.squares[0][7],
        newKingSquare: Utils.squareBitboards[Utils.squares[0][6]],
        newRookSquare: Utils.squareBitboards[Utils.squares[0][5]],
        middleSquares: Utils.squaresToBitboard([
          Utils.squares[0][5],
          Utils.squares[0][6]
        ])
      },
      {
        rookSquare: Utils.squares[0][0],
        newKingSquare: Utils.squareBitboards[Utils.squares[0][2]],
        newRookSquare: Utils.squareBitboards[Utils.squares[0][3]],
        middleSquares: Utils.squaresToBitboard([
          Utils.squares[0][1],
          Utils.squares[0][2],
          Utils.squares[0][3]
        ])
      }
    ],
    [
      {
        rookSquare: Utils.squares[7][7],
        newKingSquare: Utils.squareBitboards[Utils.squares[7][6]],
        newRookSquare: Utils.squareBitboards[Utils.squares[7][5]],
        middleSquares: Utils.squaresToBitboard([
          Utils.squares[7][5],
          Utils.squares[7][6]
        ])
      },
      {
        rookSquare: Utils.squares[7][0],
        newKingSquare: Utils.squareBitboards[Utils.squares[7][2]],
        newRookSquare: Utils.squareBitboards[Utils.squares[7][3]],
        middleSquares: Utils.squaresToBitboard([
          Utils.squares[7][1],
          Utils.squares[7][2],
          Utils.squares[7][3]
        ])
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
  static bitboardSquares: Map<bigint, number> = new Map(
    Object.entries(Utils.squareBitboards).map(([square, bitboard]) => [bitboard, +square])
  );
  static rankBitboards: { [rank in number]: { [color in Color]: bigint; }; } = _.times(8, (rank) => [
    Utils.getRankBitboard(rank),
    Utils.getRankBitboard(7 - rank)
  ]);
  static rankBitboards2 = _.mapValues(Utils.ranks, (ranks) => (
    ranks.map((rank) => Utils.squaresToBitboard(_.times(8, (file) => rank << 3 | file)))
  ));
  static fileBitboards: { [file in number]: bigint; } = _.times(8, Utils.getFileBitboard);
  static fileBitboards2 = _.mapValues(Utils.files, (file) => (
    Utils.squaresToBitboard(_.times(8, (rank) => rank << 3 | file))
  ));
  static slidingAttackBitboards: { [PieceType.BISHOP]: Attacks[]; [PieceType.ROOK]: Attacks[]; } = {
    [PieceType.BISHOP]: Utils.allSquares.map((square) => Utils.generateSlidingAttackBitboards(square, true)),
    [PieceType.ROOK]: Utils.allSquares.map((square) => Utils.generateSlidingAttackBitboards(square, false))
  };
  static kingAttackBitboards: { [square in number]: bigint; } = Utils.allSquares.map((square) => (
    Utils.traverseDirection2(square, +1, +1, 0n, false, true)
    | Utils.traverseDirection2(square, +1, -1, 0n, false, true)
    | Utils.traverseDirection2(square, -1, +1, 0n, false, true)
    | Utils.traverseDirection2(square, -1, -1, 0n, false, true)
    | Utils.traverseDirection2(square, 0, +1, 0n, false, true)
    | Utils.traverseDirection2(square, 0, -1, 0n, false, true)
    | Utils.traverseDirection2(square, +1, 0, 0n, false, true)
    | Utils.traverseDirection2(square, -1, 0, 0n, false, true)
  ));
  static knightAttackBitboards: { [square in number]: bigint; } = Utils.allSquares.map((square) => (
    Utils.traverseDirection2(square, +2, +1, 0n, false, true)
    | Utils.traverseDirection2(square, +2, -1, 0n, false, true)
    | Utils.traverseDirection2(square, -2, +1, 0n, false, true)
    | Utils.traverseDirection2(square, -2, -1, 0n, false, true)
    | Utils.traverseDirection2(square, +1, +2, 0n, false, true)
    | Utils.traverseDirection2(square, +1, -2, 0n, false, true)
    | Utils.traverseDirection2(square, -1, +2, 0n, false, true)
    | Utils.traverseDirection2(square, -1, -2, 0n, false, true)
  ));
  static pawnAttackBitboards: { [color in Color]: { [square in number]: bigint; }; } = [
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 0 || y === 7
        ? 0n
        : Utils.squaresToBitboard([Utils.squares[y + 1][x + 1], Utils.squares[y + 1][x - 1]].filter((square) => square !== undefined));
    }),
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 0 || y === 7
        ? 0n
        : Utils.squaresToBitboard([Utils.squares[y - 1][x + 1], Utils.squares[y - 1][x - 1]].filter((square) => square !== undefined));
    })
  ];
  static pawnAdvanceBitboards: { [color in Color]: Attacks[]; } = [
    Utils.generateAllPawnAdvanceBitboards(Color.WHITE),
    Utils.generateAllPawnAdvanceBitboards(Color.BLACK)
  ];

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

  static getSlidingPieceMask(square: number, isBishop: boolean, blockers: bigint, pop: boolean): bigint {
    if (isBishop) {
      return (
        Utils.traverseDirection2(square, -1, -1, blockers, pop, false)
        | Utils.traverseDirection2(square, -1, +1, blockers, pop, false)
        | Utils.traverseDirection2(square, +1, -1, blockers, pop, false)
        | Utils.traverseDirection2(square, +1, +1, blockers, pop, false)
      );
    }

    return (
      Utils.traverseDirection2(square, -1, 0, blockers, pop, false)
      | Utils.traverseDirection2(square, +1, 0, blockers, pop, false)
      | Utils.traverseDirection2(square, 0, -1, blockers, pop, false)
      | Utils.traverseDirection2(square, 0, +1, blockers, pop, false)
    );
  }

  static traverseDirection2(square: number, incrementX: number, incrementY: number, blockers: bigint, pop: boolean, stopAfter1: boolean): bigint {
    const squares: number[] = [];
    const traverse = (x: number, y: number) => {
      const nextX = x + incrementX;
      const nextY = y + incrementY;

      if (nextX < 0 || nextX > 7 || nextY < 0 || nextY > 7) {
        return;
      }

      squares.push(nextY << 3 | nextX);

      if (!(blockers & 1n << BigInt(nextY << 3 | nextX)) && !stopAfter1) {
        traverse(nextX, nextY);
      }
    };

    traverse(square & 7, square >> 3);

    if (pop) {
      squares.pop();
    }

    return Utils.squaresToBitboard(squares);
  }

  static generateSlidingAttackBitboards(square: number, isBishop: boolean): Attacks {
    const map = new Map<bigint, bigint>();
    const mask = Utils.getSlidingPieceMask(square, isBishop, 0n, true);
    const maskString = [...mask.toString(2)].reverse().join('');
    const length = BigInt(maskString.length);
    let blockers = 0n;
    const traverse = (index: bigint) => {
      if (index === length) {
        map.set(blockers, Utils.getSlidingPieceMask(square, isBishop, blockers, false));
      } else {
        traverse(index + 1n);

        if (maskString[index as any] === '1') {
          blockers += 1n << index;

          traverse(index + 1n);

          blockers -= 1n << index;
        }
      }
    };

    traverse(0n);

    return { mask, map };
  }

  static generateAllPawnAdvanceBitboards(color: Color): Attacks[] {
    return Utils.allSquares.map((square) => {
      let mask = 0n;
      const map = new Map<bigint, bigint>();
      const rank = square >> 3;
      const file = square & 7;
      const upperSquare = rank + Utils.directions.UP[color] << 3 | file;
      const doubleUpperSquare = rank + 2 * Utils.directions.UP[color] << 3 | file;

      if (rank === 0 || rank === 7) {
        map.set(0n, 0n);
      } else if (rank === Utils.ranks.RANK_2[color]) {
        mask = Utils.squareBitboards[upperSquare] | Utils.squareBitboards[doubleUpperSquare];

        map.set(0n, Utils.squareBitboards[upperSquare] | Utils.squareBitboards[doubleUpperSquare]);
        map.set(Utils.squareBitboards[upperSquare], 0n);
        map.set(Utils.squareBitboards[doubleUpperSquare], Utils.squareBitboards[upperSquare]);
        map.set(Utils.squareBitboards[upperSquare] | Utils.squareBitboards[doubleUpperSquare], 0n);
      } else {
        mask = Utils.squareBitboards[upperSquare];

        map.set(0n, Utils.squareBitboards[upperSquare]);
        map.set(Utils.squareBitboards[upperSquare], 0n);
      }

      return { mask, map };
    });
  }

  static printBitboard(bitboard: bigint): string {
    const bits: string[][] = [];

    for (let i = 0n; i < 8n; i++) {
      bits.push([]);

      for (let j = 0n; j < 8n; j++) {
        bits[i as any][j as any] = bitboard & 1n << i * 8n + j ? '1' : '.';
      }
    }

    return bits.reverse().map((row) => row.join('  ')).join('\n') + '\n';
  }

  static squaresToBitboard(squares: number[]): bigint {
    let bitboard = 0n;

    squares.forEach((square) => {
      bitboard |= Utils.squareBitboards[square];
    });

    return bitboard;
  }

  static bitboardToSquares(bitboard: bigint): number[] {
    const squares: number[] = [];
    let square = 0;

    for (; square < 64; square++) {
      if (bitboard & Utils.squareBitboards[square]) {
        squares.push(square);
      }
    }

    return squares;
  }

  static getBitsCount(bitboard: bigint): number {
    let count = 0;

    for (; bitboard; bitboard &= bitboard - 1n) {
      count++;
    }

    return count;
  }

  static getRankBitboard(rank: number): bigint {
    return Utils.squaresToBitboard(_.times(8, (file) => rank << 3 | file));
  }

  static getFileBitboard(file: number): bigint {
    return Utils.squaresToBitboard(_.times(8, (rank) => rank << 3 | file));
  }
}
