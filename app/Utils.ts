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

export interface MoveInGame {
  move: number;
  changedPiece: Piece;
  changedPieceOldSquare: number;
  capturedPiece: Piece | null;
  promotedPawn: Piece | null;
  castlingRook: Piece | null;
  wasCheck: boolean;
  prevResult: Result | null;
  prevPosition: bigint;
  prevPossibleEnPassant: EnPassant | null;
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

export interface EnPassant {
  square: number;
  pieceSquare: number;
}

export default class Utils {
  static oppositeColor: { [color in Color]: Color; } = [Color.BLACK, Color.WHITE];
  static pieceLiteral: string = 'KQRBNP';
  static pieceLiterals: { [color in Color]: string; } = ['KQRBNP', 'kqrbnp'];
  static piecesWorth: { [type in PieceType]: number; } = [100, 9, 5, 3, 3, 1];
  static pieceFromLiteral: { [literal in string]: PieceType; } = {
    k: PieceType.KING,
    q: PieceType.QUEEN,
    r: PieceType.ROOK,
    b: PieceType.BISHOP,
    n: PieceType.KNIGHT,
    p: PieceType.PAWN
  };
  static squares: number[][] = new Array(8).fill(0).map((_v, y) => (
    new Array(8).fill(0).map((_v, x) => y * 8 + x)
  ));
  static allSquares: number[] = new Array(64).fill(0).map((_v, i) => i);
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
  static castling: { [color in Color]: { [castlingSide in CastlingSide]: Castling; }; } = [[
    Castling.WHITE_KING_SIDE,
    Castling.WHITE_QUEEN_SIDE
  ], [
    Castling.BLACK_KING_SIDE,
    Castling.BLACK_QUEEN_SIDE
  ]];
  static noCastling: { [color in Color]: { [castlingSide in CastlingSide]: Castling; }; } = [[
    15 ^ Castling.WHITE_KING_SIDE,
    15 ^ Castling.WHITE_QUEEN_SIDE
  ], [
    15 ^ Castling.BLACK_KING_SIDE,
    15 ^ Castling.BLACK_QUEEN_SIDE
  ]];
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
  static pieceRanks: { [color in Color]: number; } = [0, 7];
  static pawnRanks: { [color in Color]: number; } = [1, 6];

  static getMoveFromUci(uci: string): number {
    const [fromX, fromY, toX, toY, promotion] = uci;
    const fromSquare = Utils.getSquareFromString(fromX + fromY);
    const toSquare = Utils.getSquareFromString(toX + toY);
    let move = fromSquare << 9 | toSquare << 3;

    if (promotion) {
      move |= Utils.pieceFromLiteral[promotion];
    }

    return move;
  }

  static getSquareFromString(squareString: string): number {
    return (+squareString[1] - 1) * 8 + (squareString.charCodeAt(0) - 97);
  }

  static getSquareLiteral(square: number): string {
    return `${String.fromCharCode((square & 7) + 97)}${(square >> 3) + 1}`;
  }

  static getUciFromMove(move: number): string {
    const from = Utils.getSquareLiteral(move >> 9);
    const to = Utils.getSquareLiteral(move >> 3 & 63);
    const promotion = move & 7
      ? Utils.pieceLiteral[move & 7]
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
