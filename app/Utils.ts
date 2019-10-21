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
  movedPiece: Piece;
  capturedPiece: Piece | null;
  castlingRook: Piece | null;
  wasCheck: boolean;
  wasDoubleCheck: boolean;
  prevCheckingPiece: Piece | null;
  prevPositionKey: bigint;
  prevPawnKey: bigint;
  prevPositionCount: number;
  prevPossibleEnPassant: number | null;
  prevPossibleCastling: number;
  prevPliesWithoutCaptureOrPawnMove: number;
}

export interface Piece {
  index: number;
  type: PieceType;
  color: Color;
  square: number;
}

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

export enum PinnedDirection {
  DIAGONAL,
  HORIZONTAL,
  VERTICAL
}

export type Board = (Piece | null)[];

const pieceSquareTables: Record<PieceType, number[]> = [
  // king
  [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
  ],

  // queen
  [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],

  // rook
  [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
  ],

  // bishop
  [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],

  // knight
  [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],

  // pawn
  [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
  ]
];
const kingEndgameSquareTable = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50
];

export default class Utils {
  static oppositeColor: Record<Color, Color> = [Color.BLACK, Color.WHITE];
  static pieceLiterals: Record<Color, string> = ['KQRBNP', 'kqrbnp'];
  static piecesWorth: Record<PieceType, number> = [1000, 16, 8, 5, 5, 1];
  static pieceFromLiteral: Record<string, PieceType> = {
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
  static moves: number[][] = Utils.allSquares.map((from) => (
    Utils.allSquares.map((to) => from << 9 | to << 3)
  ));
  static movesFrom = new Array(1 << 15).fill(0).map((_, move) => move >> 9);
  static movesTo = new Array(1 << 15).fill(0).map((_, move) => move >> 3 & 63);
  static squareRanks: number[] = Utils.allSquares.map((square) => square >> 3);
  static squareFiles: number[] = Utils.allSquares.map((square) => square & 7);
  static diagonalMoves: number[][][] = Utils.allSquares.map((square) => [
    Utils.traverseDirection(square, +1, +1, false),
    Utils.traverseDirection(square, +1, -1, false),
    Utils.traverseDirection(square, -1, +1, false),
    Utils.traverseDirection(square, -1, -1, false)
  ].filter((moves) => moves.length));
  static orthogonalMoves: number[][][] = Utils.allSquares.map((square) => [
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
  static kingAttacksSet: Set<number>[] = Utils.kingMoves.map((attacks) => new Set(attacks));
  static slidingAttacks: Record<PieceType.BISHOP | PieceType.ROOK | PieceType.QUEEN, number[][][]> = {
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
  static knightAttacksSet: Set<number>[] = Utils.knightMoves.map((attacks) => new Set(attacks));
  static pawnAdvanceMoves: Record<Color, number[][]> = [
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
  static pawnDoubleAdvanceMoves: Record<Color, number[]> = [
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 1
        ? Utils.squares[y + 2][x]
        : -1;
    }),
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 6
        ? Utils.squares[y - 2][x]
        : -1;
    })
  ];
  static pawnEnPassantSquaresMap: Map<number, number> = Utils.arrayToMap([
    ...Utils.squares[1],
    ...Utils.squares[6]
  ], (square) => {
    const x = square & 7;
    const y = square >> 3;

    return y === 1
      ? Utils.squares[y + 1][x]
      : Utils.squares[y - 1][x];
  });
  static pawnEnPassantSquares: Record<number, boolean> = Utils.arrayToRecord([
    ...Utils.squares[2],
    ...Utils.squares[5]
  ], () => true);
  static pawnEnPassantPieceSquares: Record<number, number> = _.mapValues(Utils.pawnEnPassantSquares, (_v, square) => (
    (+square >> 3) === 2
      ? +square + 8
      : +square - 8
  ));
  static pawnEnPassantOpponentPawnSquares: Map<number, [number, number]> = Utils.arrayToMap([
    ...Utils.squares[3],
    ...Utils.squares[4]
  ], (square) => (
    (square & 7) === 0
      ? [-1, square + 1]
      : (square & 7) === 7
        ? [square - 1, -1]
        : [square - 1, square + 1]
  ));
  static pawnAttacks: Record<Color, number[][]> = [
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 7
        ? []
        : [Utils.squares[y + 1][x + 1], Utils.squares[y + 1][x - 1]].filter((square) => square !== undefined);
    }),
    Utils.allSquares.map((square) => {
      const x = square & 7;
      const y = square >> 3;

      return y === 0
        ? []
        : [Utils.squares[y - 1][x + 1], Utils.squares[y - 1][x - 1]].filter((square) => square !== undefined);
    })
  ];
  static pawnAttacksSet: Record<Color, Set<number>[]> = _.mapValues(Utils.pawnAttacks, (colorAttacks) => (
    colorAttacks.map((attacks) => new Set(attacks))
  ));
  static promotionSquaresSet: Record<Color, Set<number>> = [
    new Set(Utils.allSquares.slice(56)),
    new Set(Utils.allSquares.slice(0, 8))
  ];
  static castling: Record<Color, Record<CastlingSide, Castling>> = [
    [Castling.WHITE_KING_SIDE, Castling.WHITE_QUEEN_SIDE],
    [Castling.BLACK_KING_SIDE, Castling.BLACK_QUEEN_SIDE]
  ];
  static fenCastling: Record<string, Castling> = {
    K: Castling.WHITE_KING_SIDE,
    Q: Castling.WHITE_QUEEN_SIDE,
    k: Castling.BLACK_KING_SIDE,
    q: Castling.BLACK_QUEEN_SIDE
  };
  static rookCastlingPermissions: Record<number, Castling> = {
    [Utils.squares[0][0]]: Castling.WHITE_QUEEN_SIDE,
    [Utils.squares[7][0]]: Castling.BLACK_QUEEN_SIDE,
    [Utils.squares[0][7]]: Castling.WHITE_KING_SIDE,
    [Utils.squares[7][7]]: Castling.BLACK_KING_SIDE
  };
  static kingCastlingSides: Record<number, CastlingSide> = {
    [Utils.squares[0][2]]: CastlingSide.QUEEN,
    [Utils.squares[7][2]]: CastlingSide.QUEEN,
    [Utils.squares[0][6]]: CastlingSide.KING,
    [Utils.squares[7][6]]: CastlingSide.KING
  };
  static castlingParams: Record<Color, Record<CastlingSide, CastlingParams>> = [
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
  static kingInitialSquares: Record<Color, number> = [Utils.squares[0][4], Utils.squares[7][4]];
  static rookInitialSquares: Record<number, number> = {
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
  static isAligned: boolean[][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => (
      Utils.isAlignedOrthogonally[square1][square2] || Utils.isAlignedDiagonally[square1][square2]
    ))
  ));
  static isPieceAligned: Record<PieceType.BISHOP | PieceType.ROOK | PieceType.QUEEN, boolean>[][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => ({
      [PieceType.BISHOP]: Utils.isAlignedDiagonally[square1][square2],
      [PieceType.ROOK]: Utils.isAlignedOrthogonally[square1][square2],
      [PieceType.QUEEN]: Utils.isAligned[square1][square2]
    }))
  ));
  static isOnOneLine: boolean[][][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => (
      Utils.allSquares.map((square3) => (
        ((square1 >> 3) - (square2 >> 3)) * ((square1 & 7) - (square3 & 7))
        === ((square1 >> 3) - (square3 >> 3)) * ((square1 & 7) - (square2 & 7))
      ))
    ))
  ));
  static middleSquares: number[][][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => {
      if (square1 === square2 || !Utils.isAligned[square1][square2]) {
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
  static middleSquaresSet: Set<number>[][] = Utils.middleSquares.map((middleSquares) => (
    middleSquares.map((middleSquares) => new Set(middleSquares))
  ));
  static behindSquares: number[][][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => {
      if (square1 === square2 || !Utils.isAligned[square1][square2]) {
        return [];
      }

      const incrementX = Math.sign((square2 & 7) - (square1 & 7));
      const incrementY = Math.sign((square2 >> 3) - (square1 >> 3));

      return Utils.traverseDirection(square2, incrementX, incrementY, false);
    })
  ));
  static behindAndMiddleSquaresSet: Set<number>[][] = Utils.allSquares.map((square1) => (
    Utils.allSquares.map((square2) => new Set([
      ...Utils.middleSquares[square1][square2],
      ...Utils.behindSquares[square1][square2]
    ]))
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
  static pieceSquareTables: Record<Color, Record<PieceType, [number[], number[]]>> = [
    [
      [
        pieceSquareTables[PieceType.KING],
        kingEndgameSquareTable
      ],
      [
        pieceSquareTables[PieceType.QUEEN],
        pieceSquareTables[PieceType.QUEEN]
      ],
      [
        pieceSquareTables[PieceType.ROOK],
        pieceSquareTables[PieceType.ROOK]
      ],
      [
        pieceSquareTables[PieceType.BISHOP],
        pieceSquareTables[PieceType.BISHOP]
      ],
      [
        pieceSquareTables[PieceType.KNIGHT],
        pieceSquareTables[PieceType.KNIGHT]
      ],
      [
        pieceSquareTables[PieceType.PAWN],
        pieceSquareTables[PieceType.PAWN]
      ]
    ],
    [
      [
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.KING]),
        Utils.invertPieceSquareTable(kingEndgameSquareTable)
      ],
      [
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.QUEEN]),
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.QUEEN])
      ],
      [
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.ROOK]),
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.ROOK])
      ],
      [
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.BISHOP]),
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.BISHOP])
      ],
      [
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.KNIGHT]),
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.KNIGHT])
      ],
      [
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.PAWN]),
        Utils.invertPieceSquareTable(pieceSquareTables[PieceType.PAWN])
      ]
    ]
  ];

  static arrayToMap<T, R>(array: T[], callback: (value: T) => R): Map<T, R> {
    const map: Map<T, R> = new Map();

    array.forEach((value) => {
      map.set(value, callback(value));
    });

    return map;
  }

  static arrayToRecord<T extends keyof any, R>(array: T[], callback: (value: T) => R): Record<T, R> {
    const record = {} as Record<T, R>;

    array.forEach((value) => {
      record[value] = callback(value);
    });

    return record;
  }

  static invertPieceSquareTable(table: number[]): number[] {
    return table.map((_, square) => {
      const rank = square >> 3;
      const file = square & 7;

      return table[(7 - rank) << 3 | file];
    });
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
