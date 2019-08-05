import Utils, {
  Board,
  CastlingSide,
  Color,
  EnPassant,
  MoveInGame,
  Piece,
  PieceType,
  PossibleCastling,
  Result
} from './Utils';

enum GetPossibleMovesType {
  MOVE,
  ATTACKED
}

export default class Game extends Utils {
  static getStartingPieces(): { [color in Color]: { [id in number]: Piece; }; } {
    let id = 0;
    const piece = (color: Color, type: PieceType, x: number, y: number): Piece => ({
      id: id++,
      color,
      type,
      square: Game.squares[y][x]
    });
    const pieces = [
      PieceType.ROOK,
      PieceType.KNIGHT,
      PieceType.BISHOP,
      PieceType.QUEEN,
      PieceType.KING,
      PieceType.BISHOP,
      PieceType.KNIGHT,
      PieceType.ROOK,
    ];
    const pawns = new Array<PieceType>(8).fill(PieceType.PAWN);
    const getAllPieces = (color: Color): { [id in number]: Piece; } => [
      ...pieces.map((type, x) => piece(color, type, x, color === Color.WHITE ? 0 : 7)),
      ...pawns.map((type, x) => piece(color, type, x, color === Color.WHITE ? 1 : 6)),
    ].reduce((pieces, piece) => {
      pieces[piece.id] = piece;

      return pieces;
    }, {} as { [id in number]: Piece; });

    return [
      getAllPieces(Color.WHITE),
      getAllPieces(Color.BLACK)
    ];
  }

  turn: Color = Color.WHITE;
  result: Result | null = null;
  isCheck: boolean = false;
  board: Board = Game.allSquares.map(() => null);
  kings: { [color in Color]: Piece; };
  pieces: { [color in Color]: { [id in number]: Piece; }; } = Game.getStartingPieces();
  pieceCounts: { [color in Color]: number; } = [0, 0];
  moves: MoveInGame[] = [];
  positionString: string;
  positions: { [position in string]: number; } = {};
  possibleCastling: PossibleCastling = [[true, true], [true, true]];
  possibleEnPassant: EnPassant | null = null;
  pliesWithoutCaptureOrPawnMove: number = 0;

  constructor() {
    super();

    const findKing = (color: Color): Piece | undefined => {
      for (const pieceId in this.pieces[color]) {
        const piece = this.pieces[color][pieceId];

        if (this.pieces[color][pieceId].type === PieceType.KING) {
          return piece;
        }
      }
    };

    this.positionString = '*'.repeat(64) + this.getPositionStringWithoutBoard();
    this.kings = [findKing(Color.WHITE)!, findKing(Color.BLACK)!];

    this.setStartingData();
  }

  getLegalMoves(piece: Piece, constructResult: boolean): number[] {
    const turn = this.turn;
    const legalMoves: number[] = [];
    const possibleMoves = this.getPossibleMoves(piece, GetPossibleMovesType.MOVE);

    for (let i = 0, l = possibleMoves.length; i < l; i++) {
      const square = possibleMoves[i];

      this.performMove(piece.square << 9 | square << 3, constructResult);

      if (!this.isInCheck(turn)) {
        legalMoves.push(square);
      }

      this.revertLastMove();
    }

    return legalMoves;
  }

  getPositionStringWithoutBoard(): string {
    return `${
      this.turn
    }${
      +this.possibleCastling[Color.WHITE][CastlingSide.KING]
    }${
      +this.possibleCastling[Color.WHITE][CastlingSide.QUEEN]
    }${
      +this.possibleCastling[Color.BLACK][CastlingSide.KING]
    }${
      +this.possibleCastling[Color.BLACK][CastlingSide.QUEEN]
    }${this.possibleEnPassant ? `${this.possibleEnPassant.square}` : ''}`;
  }

  getPossibleMoves(piece: Piece, type: GetPossibleMovesType): number[] {
    const {
      type: pieceType,
      color: pieceColor,
      square: pieceSquare
    } = piece;
    const possibleMoves: number[] = [];

    if (pieceType !== PieceType.PAWN) {
      const pieceMoves = Game.pieceMoves[pieceType][pieceSquare];

      for (let i = 0, l = pieceMoves.length; i < l; i++) {
        const directionMoves = pieceMoves[i];

        for (let i = 0, l = directionMoves.length; i < l; i++) {
          const square = directionMoves[i];
          const pieceInSquare = this.board[square];

          if (pieceInSquare) {
            if (pieceInSquare.color !== pieceColor) {
              possibleMoves.push(square);
            }

            break;
          } else {
            possibleMoves.push(square);
          }
        }
      }
    }

    if (pieceType === PieceType.KING && type === GetPossibleMovesType.MOVE && !this.isCheck) {
      const possibleCastling = this.possibleCastling[pieceColor];
      const castlings: CastlingSide[] = [];

      if (possibleCastling[CastlingSide.KING]) {
        castlings.push(CastlingSide.KING);
      }

      if (possibleCastling[CastlingSide.QUEEN]) {
        castlings.push(CastlingSide.QUEEN);
      }

      if (castlings.length) {
        castling: for (let i = 0, l = castlings.length; i < l; i++) {
          const {
            newRookSquare,
            newKingSquare,
            middleSquares
          } = Game.possibleCastling[pieceColor][castlings[i]];

          if (this.board[newKingSquare]) {
            continue;
          }

          for (let i = 0, l = middleSquares.length - 1; i < l; i++) {
            if (this.board[middleSquares[i]]) {
              continue castling;
            }
          }

          if (this.isAttackedByOpponentPiece(newRookSquare, Game.oppositeColor[pieceColor])) {
            continue;
          }

          possibleMoves.push(newKingSquare);
        }
      }
    }

    if (pieceType === PieceType.PAWN) {
      if (type === GetPossibleMovesType.MOVE) {
        const advanceMoves = Game.pawnAdvanceMoves[pieceColor][pieceSquare];

        for (let i = 0, l = advanceMoves.length; i < l; i++) {
          const square = advanceMoves[i];
          const pieceInSquare = this.board[square];

          if (pieceInSquare) {
            break;
          }

          possibleMoves.push(square);
        }
      }

      const captureMoves = Game.pawnCaptureMoves[pieceColor][pieceSquare];

      for (let i = 0, l = captureMoves.length; i < l; i++) {
        const square = captureMoves[i];

        if (this.possibleEnPassant && this.possibleEnPassant.square === square) {
          possibleMoves.push(square);

          continue;
        }

        const pieceInSquare = this.board[square];

        if (
          pieceInSquare
          && (
            pieceInSquare.color !== pieceColor
            || type === GetPossibleMovesType.ATTACKED
          )
        ) {
          possibleMoves.push(square);
        }
      }
    }

    return possibleMoves;
  }

  isAttackedByOpponentPiece(square: number, opponentColor: Color): boolean {
    const opponentPieces = this.pieces[opponentColor];

    for (const pieceId in opponentPieces) {
      const possibleMoves = this.getPossibleMoves(opponentPieces[pieceId], GetPossibleMovesType.ATTACKED);

      for (let i = 0, l = possibleMoves.length; i < l; i++) {
        if (possibleMoves[i] === square) {
          return true;
        }
      }
    }

    return false;
  }

  isCheckmate(): boolean {
    return this.isCheck && this.isNoMoves();
  }

  isDraw(): boolean {
    return (
      this.pliesWithoutCaptureOrPawnMove >= 100
      || this.positions[this.positionString] >= 3
      || this.isStalemate()
      || this.isInsufficientMaterial()
    );
  }

  isInCheck(color: Color): boolean {
    const opponentColor = Game.oppositeColor[color];

    return this.isAttackedByOpponentPiece(this.kings[color].square, opponentColor);
  }

  isInsufficientMaterial(): boolean {
    const whiteHasMore = this.pieceCounts[Color.WHITE] > this.pieceCounts[Color.BLACK];
    const minPiecesColor = whiteHasMore
      ? Color.BLACK
      : Color.WHITE;
    const maxPiecesColor = whiteHasMore
      ? Color.WHITE
      : Color.BLACK;
    const maxPieceCounts = this.pieceCounts[maxPiecesColor];

    // king vs king
    if (maxPieceCounts === 1) {
      return true;
    }

    const maxPieces = this.pieces[maxPiecesColor];

    if (this.pieceCounts[minPiecesColor] === 1 || maxPieceCounts === 2) {
      for (const pieceId in maxPieces) {
        if (maxPieces[pieceId].type === PieceType.KNIGHT) {
          return true;
        }
      }

      return false;
    }

    const minPieces = this.pieces[minPiecesColor];
    let possibleBishopColor: number | null = null;

    for (const pieceId in maxPieces) {
      const piece = maxPieces[pieceId];

      if (piece.type === PieceType.KING) {
        continue;
      }

      if (piece.type !== PieceType.BISHOP) {
        return false;
      }

      if (possibleBishopColor === null) {
        possibleBishopColor = piece.square & 1;
      } else if ((piece.square & 1) !== possibleBishopColor) {
        return false;
      }
    }

    for (const pieceId in minPieces) {
      const piece = maxPieces[pieceId];

      if (piece.type === PieceType.KING) {
        continue;
      }

      if (piece.type !== PieceType.BISHOP || (piece.square & 1) !== possibleBishopColor) {
        return false;
      }
    }

    return true;
  }

  isNoMoves(): boolean {
    const pieces = this.pieces[this.turn];

    for (const pieceId in pieces) {
      if (this.getLegalMoves(pieces[pieceId], false).length) {
        return false;
      }
    }

    return true;
  }

  isStalemate(): boolean {
    return !this.isCheck && this.isNoMoves();
  }

  movePiece(piece: Piece, square: number) {
    this.positionString = this.positionString.slice(0, piece.square) + '*' + this.positionString.slice(piece.square + 1);
    this.positionString = this.positionString.slice(0, square) + Game.pieceLiteral[piece.type] + this.positionString.slice(square + 1);

    this.board[piece.square] = null;
    this.board[square] = piece;

    piece.square = square;
  }

  performMove(move: number, constructResult: boolean) {
    const from = move >> 9;
    const to = move >> 3 & 63;
    const promotion = move & 7;
    const piece = this.board[from]!;
    const {
      type: pieceType,
      color: pieceColor
    } = piece;
    const nextTurn = Game.oppositeColor[this.turn];
    const changedPieces: { piece: Piece; oldSquare: number; }[] = [{ piece, oldSquare: from }];
    const wasCheck = this.isCheck;
    const prevResult = this.result;
    const prevPositionString = this.positionString;
    const prevPossibleEnPassant = this.possibleEnPassant;
    const prevPossibleCastling = this.possibleCastling;
    const newPossibleCastling: PossibleCastling = [[
      this.possibleCastling[Color.WHITE][CastlingSide.KING],
      this.possibleCastling[Color.WHITE][CastlingSide.QUEEN]
    ], [
      this.possibleCastling[Color.BLACK][CastlingSide.KING],
      this.possibleCastling[Color.BLACK][CastlingSide.QUEEN]
    ]];
    const prevPliesWithoutCaptureOrPawnMove = this.pliesWithoutCaptureOrPawnMove;
    const isEnPassantCapture = pieceType === PieceType.PAWN && !!this.possibleEnPassant && to === this.possibleEnPassant.square;
    const capturedPiece = isEnPassantCapture
      ? this.board[this.possibleEnPassant!.pieceSquare]
      : this.board[to];

    this.movePiece(piece, to);

    if (pieceType === PieceType.KING) {
      newPossibleCastling[pieceColor][CastlingSide.KING] = false;
      newPossibleCastling[pieceColor][CastlingSide.QUEEN] = false;
    }

    if (pieceType === PieceType.ROOK && from in Game.rookCastlingSides) {
      newPossibleCastling[pieceColor][Game.rookCastlingSides[from]] = false;
    }

    if (
      pieceType === PieceType.KING
      && from === Game.kingInitialSquares[pieceColor]
      && to in Game.kingCastlingSides
    ) {
      const {
        rookSquare,
        newRookSquare
      } = Game.possibleCastling[pieceColor][Game.kingCastlingSides[to]];
      const rook = this.board[rookSquare]!;

      this.movePiece(rook, newRookSquare);
      changedPieces.push({ piece: rook, oldSquare: rookSquare });
    }

    if (capturedPiece) {
      this.removePiece(capturedPiece, isEnPassantCapture);

      if (capturedPiece.type === PieceType.ROOK && capturedPiece.square in Game.rookCastlingSides) {
        newPossibleCastling[nextTurn][Game.rookCastlingSides[capturedPiece.square]] = false;
      }
    }

    if (capturedPiece || pieceType === PieceType.PAWN) {
      this.pliesWithoutCaptureOrPawnMove++;
    } else {
      this.pliesWithoutCaptureOrPawnMove = 0;
    }

    if (promotion) {
      piece.type = promotion;
    }

    if (pieceType === PieceType.PAWN && Game.pawnDoubleAdvanceMoves[pieceColor][from] === to) {
      this.possibleEnPassant = {
        square: Game.pawnEnPassantSquares[pieceColor][from],
        pieceSquare: to
      };
    } else {
      this.possibleEnPassant = null;
    }

    this.turn = nextTurn;
    this.isCheck = this.isInCheck(this.turn);
    this.possibleCastling = newPossibleCastling;
    this.positionString = this.positionString.slice(0, 64) + this.getPositionStringWithoutBoard();
    this.positions[this.positionString] = this.positions[this.positionString] + 1 || 1;

    if (constructResult) {
      if (this.isCheckmate()) {
        this.result = pieceColor as 0 | 1;
      } else if (this.isDraw()) {
        this.result = Result.DRAW;
      }
    }

    this.moves.push({
      move,
      changedPieces,
      capturedPiece,
      promotedPawn: promotion ? piece : null,
      wasCheck,
      prevResult,
      prevPositionString,
      prevPossibleEnPassant,
      prevPossibleCastling,
      prevPliesWithoutCaptureOrPawnMove
    });
  }

  removePiece(piece: Piece, removeFromBoard: boolean) {
    delete this.pieces[piece.color][piece.id];

    this.pieceCounts[piece.color]--;

    if (removeFromBoard) {
      this.board[piece.square] = null;
      this.positionString = this.positionString.slice(0, piece.square) + '*' + this.positionString.slice(piece.square + 1);
    }
  }

  revertLastMove() {
    const lastMove = this.moves.pop();

    if (lastMove) {
      const prevTurn = Game.oppositeColor[this.turn];
      const {
        changedPieces,
        capturedPiece,
        promotedPawn,
        wasCheck,
        prevResult,
        prevPositionString,
        prevPossibleEnPassant,
        prevPossibleCastling
      } = lastMove;

      for (let i = 0, l = changedPieces.length; i < l; i++) {
        const changedPiece = changedPieces[i];

        this.board[changedPiece.piece.square] = null;
        this.board[changedPiece.oldSquare] = changedPiece.piece;
        changedPiece.piece.square = changedPiece.oldSquare;
      }

      if (capturedPiece) {
        this.pieces[capturedPiece.color][capturedPiece.id] = capturedPiece;
        this.pieceCounts[capturedPiece.color]++;
        this.board[capturedPiece.square] = capturedPiece;
      }

      if (promotedPawn) {
        promotedPawn.type = PieceType.PAWN;
      }

      this.isCheck = wasCheck;
      this.positions[this.positionString]--;
      this.positionString = prevPositionString;
      this.possibleEnPassant = prevPossibleEnPassant;
      this.possibleCastling = prevPossibleCastling;
      this.turn = prevTurn;
      this.result = prevResult;
    }
  }

  setStartingData() {
    const addPiecesToBoard = (color: Color) => {
      for (const pieceId in this.pieces[color]) {
        const piece = this.pieces[color][pieceId];

        this.movePiece(piece, piece.square);

        this.pieceCounts[color]++;
      }
    };

    addPiecesToBoard(Color.WHITE);
    addPiecesToBoard(Color.BLACK);
  }
}
