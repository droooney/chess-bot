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

export interface Square {
  readonly x: number;
  readonly y: number;
}

export interface PossibleMove {
  piece: Piece;
  square: number;
  castling?: Castling;
  capturedPiece?: Piece;
  enPassant?: EnPassant;
}

export interface MoveInGame {
  move: number;
  changedPieces: { piece: Piece; oldSquare: number; }[];
  capturedPiece: Piece | null;
  promotedPawn: Piece | null;
  prevResult: Result | null;
  prevPositionString: string;
  prevPossibleEnPassant: EnPassant | null;
  prevCastlingPossible: { [castlingSide in CastlingSide]: boolean; };
  prevPliesWithoutCaptureOrPawnMove: number;
}

export interface Piece {
  id: number;
  type: PieceType;
  color: Color;
  square: number;
}

export enum CastlingSide {
  KING,
  QUEEN
}

export interface Castling {
  rookSquare: number;
  newKingSquare: number;
  newRookSquare: number;
  middleSquares: number[];
}

export type PossibleCastling = {
  [color in Color]: {
    [castlingSide in CastlingSide]: Castling;
  };
};

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
  static pieceFromLiteral: { [literal in string]: PieceType; } = {
    K: PieceType.KING,
    Q: PieceType.QUEEN,
    R: PieceType.ROOK,
    B: PieceType.BISHOP,
    N: PieceType.KNIGHT,
    P: PieceType.PAWN
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
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 0 || y === 7
        ? []
        : y === 1
          ? [Utils.squares[y + 1][x], Utils.squares[y + 2][x]]
          : [Utils.squares[y + 1][x]];
    }),
    Utils.allSquares.map((square) => {
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 0 || y === 7
        ? []
        : y === 6
          ? [Utils.squares[y - 1][x], Utils.squares[y - 2][x]]
          : [Utils.squares[y - 1][x]];
    })
  ];
  static pawnDoubleAdvanceMoves: { [color in Color]: { [square in number]: number | null; }; } = [
    Utils.allSquares.map((square) => {
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 1
        ? Utils.squares[y + 2][x]
        : null;
    }),
    Utils.allSquares.map((square) => {
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 1
        ? Utils.squares[y - 2][x]
        : null;
    })
  ];
  static pawnEnPassantSquares: { [color in Color]: { [square in number]: number; }; } = [
    Utils.allSquares.map((square) => {
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 1
        ? Utils.squares[y + 1][x]
        : -1;
    }),
    Utils.allSquares.map((square) => {
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 1
        ? Utils.squares[y - 1][x]
        : -1;
    })
  ];
  static pawnCaptureMoves: { [color in Color]: { [square in number]: number[]; }; } = [
    Utils.allSquares.map((square) => {
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 0 || y === 7
        ? []
        : [Utils.squares[y + 1][x + 1], Utils.squares[y + 1][x - 1]].filter(Boolean);
    }),
    Utils.allSquares.map((square) => {
      const x = square % 8;
      const y = Math.floor(square / 8);

      return y === 0 || y === 7
        ? []
        : [Utils.squares[y - 1][x + 1], Utils.squares[y - 1][x - 1]].filter(Boolean);
    })
  ];
  static promotionSquares: { [type in Color]: { [square in number]: true; }; } = [
    Utils.allSquares.slice(56).reduce((squares, square) => ({ ...squares, [square]: true }), {}),
    Utils.allSquares.slice(0, 8).reduce((squares, square) => ({ ...squares, [square]: true }), {})
  ];
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
  static possibleCastling: PossibleCastling = [
    [
      {
        rookSquare: Utils.squares[0][0],
        newKingSquare: Utils.squares[0][2],
        newRookSquare: Utils.squares[0][3],
        middleSquares: [
          Utils.squares[0][1],
          Utils.squares[0][2],
          Utils.squares[0][3]
        ]
      },
      {
        rookSquare: Utils.squares[0][7],
        newKingSquare: Utils.squares[0][6],
        newRookSquare: Utils.squares[0][5],
        middleSquares: [
          Utils.squares[0][5],
          Utils.squares[0][6]
        ]
      }
    ],
    [
      {
        rookSquare: Utils.squares[7][0],
        newKingSquare: Utils.squares[7][2],
        newRookSquare: Utils.squares[7][3],
        middleSquares: [
          Utils.squares[7][1],
          Utils.squares[7][2],
          Utils.squares[7][3]
        ]
      },
      {
        rookSquare: Utils.squares[7][7],
        newKingSquare: Utils.squares[7][6],
        newRookSquare: Utils.squares[7][5],
        middleSquares: [
          Utils.squares[7][5],
          Utils.squares[7][6]
        ]
      }
    ]
  ];
  static kingInitialSquares: { [color in Color]: number; } = [Utils.squares[0][3], Utils.squares[7][3]];

  static getMoveFromUci(uci: string): number {
    const [fromX, fromY, toX, toY, promotion] = uci;
    const fromSquare = Utils.getSquareFromString(fromX + fromY);
    const toSquare = Utils.getSquareFromString(toX + toY);
    let move = fromSquare << 9 | toSquare << 3;

    if (promotion) {
      move |= Utils.pieceFromLiteral[promotion.toUpperCase()];
    }

    return move;
  }

  static getSquareFromString(squareString: string): number {
    return (+squareString[1] - 1) * 8 + (squareString.charCodeAt(0) - 97);
  }

  static getSquareLiteral(square: number): string {
    return `${String.fromCharCode((square % 8) + 97)}${Math.floor(square / 8) + 1}`;
  }

  static getUciFromMove(move: number): string {
    const from = Utils.getSquareLiteral(move >> 9);
    const to = Utils.getSquareLiteral(move >> 3);
    const promotion = move & 7
      ? Utils.pieceLiteral[move & 7]
      : '';

    return from + to + promotion;
  }

  static traverseDirection(square: number, incrementX: number, incrementY: number, stopAfter1: boolean): number[] {
    const nextX = (square % 8) + incrementX;
    const nextY = Math.floor(square / 8) + incrementY;

    if (nextY < 0 || nextY > 7) {
      return [];
    }

    const nextSquare = Utils.squares[nextY][nextX];

    if (!nextSquare) {
      return [];
    }

    if (stopAfter1) {
      return [nextSquare];
    }

    return [nextSquare, ...Utils.traverseDirection(nextSquare, incrementX, incrementY, false)];
  }
}
