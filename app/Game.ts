import * as _ from 'lodash';

import Utils, {
  Board,
  CastlingSide,
  Color,
  ColorPieces,
  MoveInGame,
  Piece,
  PieceType,
  Result
} from './Utils';

export enum GetPossibleMovesType {
  MOVE,
  ATTACKED
}

export default class Game extends Utils {
  static standardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  generateKey = (): bigint => {
    let n = 0n;

    while (!n || (n as any) in this.keys) {
      n = 0n;

      for (let i = 0; i < 64; i++) {
        n = n << 1n | (Math.random() > 0.5 ? 1n : 0n);
      }
    }

    this.keys[n as any] = true;

    return n;
  };

  turn: Color = Color.WHITE;
  result: Result | null = null;
  isCheck: boolean = false;
  board: Board = Game.allSquares.map(() => null);
  kings: { [color in Color]: Piece; } = [null!, null!];
  keys: { [key in string]: true; } = {};
  pieces: { [color in Color]: ColorPieces; } = [{}, {}];
  pieceCounts: { [color in Color]: number; } = [0, 0];
  material: { [color in Color]: number; } = [0, 0];
  moves: MoveInGame[] = [];
  position: bigint = 0n;
  positions: Map<bigint, number> = new Map();
  possibleCastling: number = 0;
  possibleEnPassant: number | null = null;
  pliesWithoutCaptureOrPawnMove: number = 0;
  turnKey = this.generateKey();
  castlingKeys: bigint[] = new Array(16).fill(0).map(this.generateKey);
  enPassantKeys: { [square in number]: bigint; } = _.mapValues(Game.pawnEnPassantSquares, this.generateKey);
  pieceKeys: { [color in Color]: { [pieceType in PieceType]: { [square in number]: bigint; }; }; } = [
    [
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey)
    ],
    [
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey),
      Game.allSquares.map(this.generateKey)
    ]
  ];

  constructor(fen: string) {
    super();

    this.setStartingData(fen);
  }

  getLegalMoves(piece: Piece): number[] {
    const turn = this.turn;
    const legalMoves: number[] = [];
    const possibleMoves = this.getPossibleMoves(piece, GetPossibleMovesType.MOVE);

    for (let i = 0, l = possibleMoves.length; i < l; i++) {
      const square = possibleMoves[i];

      this.performMove(piece.square << 9 | square << 3, false);

      if (!this.isInCheck(turn)) {
        legalMoves.push(square);
      }

      this.revertLastMove();
    }

    return legalMoves;
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
            if (pieceInSquare.color !== pieceColor || type === GetPossibleMovesType.ATTACKED) {
              possibleMoves.push(square);
            }

            break;
          } else {
            possibleMoves.push(square);
          }
        }
      }
    }

    if (
      pieceType === PieceType.KING
      && pieceSquare === Game.kingInitialSquares[pieceColor]
      && type === GetPossibleMovesType.MOVE
      && !this.isCheck
    ) {
      const castlings: CastlingSide[] = [];

      if (this.possibleCastling & Game.castling[pieceColor][CastlingSide.KING]) {
        castlings.push(CastlingSide.KING);
      }

      if (this.possibleCastling & Game.castling[pieceColor][CastlingSide.QUEEN]) {
        castlings.push(CastlingSide.QUEEN);
      }

      if (castlings.length) {
        castling: for (let i = 0, l = castlings.length; i < l; i++) {
          const {
            newRookSquare,
            newKingSquare,
            middleSquares
          } = Game.castlingParams[pieceColor][castlings[i]];

          for (let i = 0, l = middleSquares.length; i < l; i++) {
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

        if (this.possibleEnPassant === square) {
          possibleMoves.push(square);

          continue;
        }

        const pieceInSquare = this.board[square];

        if (
          type === GetPossibleMovesType.ATTACKED
          || (
            pieceInSquare
            && pieceInSquare.color !== pieceColor
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
      || this.positions.get(this.position)! >= 3
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
    const maxPieceCount = this.pieceCounts[maxPiecesColor];

    // king vs king
    if (maxPieceCount === 1) {
      return true;
    }

    const maxPieces = this.pieces[maxPiecesColor];

    if (this.pieceCounts[minPiecesColor] === 1 && maxPieceCount === 2) {
      for (const pieceId in maxPieces) {
        if (maxPieces[pieceId].type === PieceType.KNIGHT || maxPieces[pieceId].type === PieceType.BISHOP) {
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
      const piece = minPieces[pieceId];

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
      if (this.getLegalMoves(pieces[pieceId]).length) {
        return false;
      }
    }

    return true;
  }

  isStalemate(): boolean {
    return !this.isCheck && this.isNoMoves();
  }

  movePiece(piece: Piece, square: number) {
    this.position ^= this.pieceKeys[piece.color][piece.type][piece.square];
    this.position ^= this.pieceKeys[piece.color][piece.type][square];

    this.board[piece.square] = null;
    this.board[square] = piece;

    piece.square = square;
  }

  performMove(move: number, constructResult: boolean) {
    const from = move >> 9;
    const to = move >> 3 & 63;
    const promotion: PieceType = move & 7;
    const piece = this.board[from]!;
    const {
      type: pieceType,
      color: pieceColor
    } = piece;
    const nextTurn = Game.oppositeColor[this.turn];
    const wasCheck = this.isCheck;
    const prevResult = this.result;
    const prevPosition = this.position;
    const prevPossibleEnPassant = this.possibleEnPassant;
    const prevPossibleCastling = this.possibleCastling;
    const prevPliesWithoutCaptureOrPawnMove = this.pliesWithoutCaptureOrPawnMove;
    const isEnPassantCapture = pieceType === PieceType.PAWN && to === this.possibleEnPassant;
    const capturedPiece = isEnPassantCapture
      ? this.board[Game.pawnEnPassantPieceSquares[to]]
      : this.board[to];
    let castlingRook: Piece | null = null;

    this.movePiece(piece, to);

    if (pieceType === PieceType.KING) {
      this.possibleCastling &= (
        ~Game.castling[pieceColor][CastlingSide.KING]
        & ~Game.castling[pieceColor][CastlingSide.QUEEN]
      );
    }

    if (pieceType === PieceType.ROOK && from in Game.rookCastlingSides) {
      this.possibleCastling &= ~Game.castling[pieceColor][Game.rookCastlingSides[from]];
    }

    if (
      pieceType === PieceType.KING
      && from === Game.kingInitialSquares[pieceColor]
      && to in Game.kingCastlingSides
    ) {
      const {
        rookSquare,
        newRookSquare
      } = Game.castlingParams[pieceColor][Game.kingCastlingSides[to]];
      const rook = this.board[rookSquare]!;

      this.movePiece(rook, newRookSquare);

      castlingRook = rook;
    }

    if (capturedPiece) {
      this.removePiece(capturedPiece, isEnPassantCapture);

      if (capturedPiece.type === PieceType.ROOK && capturedPiece.square in Game.rookCastlingSides) {
        this.possibleCastling &= ~Game.castling[nextTurn][Game.rookCastlingSides[capturedPiece.square]];
      }
    }

    if (capturedPiece || pieceType === PieceType.PAWN) {
      this.pliesWithoutCaptureOrPawnMove = 0;
    } else {
      this.pliesWithoutCaptureOrPawnMove++;
    }

    if (promotion) {
      piece.type = promotion;
      this.material[pieceColor] += Game.piecesWorth[promotion] - Game.piecesWorth[PieceType.PAWN];
    }

    if (pieceType === PieceType.PAWN && Game.pawnDoubleAdvanceMoves[pieceColor][from] === to) {
      const enPassantSquare = Game.pawnEnPassantSquaresMap[from];

      this.possibleEnPassant = enPassantSquare;
      this.position ^= this.enPassantKeys[enPassantSquare];
    } else {
      this.possibleEnPassant = null;
    }

    this.position ^= this.turnKey;
    this.position ^= this.castlingKeys[prevPossibleCastling];
    this.position ^= this.castlingKeys[this.possibleCastling];

    if (prevPossibleEnPassant) {
      this.position ^= this.enPassantKeys[prevPossibleEnPassant];
    }

    this.turn = nextTurn;
    this.isCheck = this.isInCheck(this.turn);
    this.positions.set(this.position, this.positions.get(this.position)! + 1 || 1);

    if (constructResult) {
      if (this.isCheckmate()) {
        this.result = pieceColor as 0 | 1;
      } else if (this.isDraw()) {
        this.result = Result.DRAW;
      }
    }

    this.moves.push({
      move,
      changedPiece: piece,
      changedPieceOldSquare: from,
      capturedPiece,
      promotedPawn: promotion ? piece : null,
      castlingRook,
      wasCheck,
      prevResult,
      prevPosition,
      prevPossibleEnPassant,
      prevPossibleCastling,
      prevPliesWithoutCaptureOrPawnMove
    });
  }

  removePiece(piece: Piece, removeFromBoard: boolean) {
    delete this.pieces[piece.color][piece.id];

    this.pieceCounts[piece.color]--;
    this.material[piece.color] -= Game.piecesWorth[piece.type];

    if (removeFromBoard) {
      this.board[piece.square] = null;
      this.position ^= this.pieceKeys[piece.color][piece.type][piece.square];
    }
  }

  revertLastMove() {
    const lastMove = this.moves.pop();

    if (lastMove) {
      const prevTurn = Game.oppositeColor[this.turn];
      const {
        changedPiece,
        changedPieceOldSquare,
        capturedPiece,
        promotedPawn,
        castlingRook,
        wasCheck,
        prevResult,
        prevPosition,
        prevPossibleEnPassant,
        prevPossibleCastling,
        prevPliesWithoutCaptureOrPawnMove
      } = lastMove;

      this.board[changedPiece.square] = null;
      this.board[changedPieceOldSquare] = changedPiece;
      changedPiece.square = changedPieceOldSquare;

      if (capturedPiece) {
        this.pieces[capturedPiece.color][capturedPiece.id] = capturedPiece;
        this.pieceCounts[capturedPiece.color]++;
        this.material[capturedPiece.color] += Game.piecesWorth[capturedPiece.type];
        this.board[capturedPiece.square] = capturedPiece;
      }

      if (promotedPawn) {
        this.material[promotedPawn.color] -= Game.piecesWorth[promotedPawn.type] - Game.piecesWorth[PieceType.PAWN];
        promotedPawn.type = PieceType.PAWN;
      }

      if (castlingRook) {
        const oldSquare = Game.rookInitialSquares[castlingRook.square];

        this.board[castlingRook.square] = null;
        this.board[oldSquare] = castlingRook;
        castlingRook.square = oldSquare;
      }

      this.isCheck = wasCheck;
      this.positions.set(this.position, this.positions.get(this.position)! - 1);

      if (!this.positions.get(this.position)) {
        this.positions.delete(this.position);
      }

      this.position = prevPosition;
      this.possibleEnPassant = prevPossibleEnPassant;
      this.possibleCastling = prevPossibleCastling;
      this.pliesWithoutCaptureOrPawnMove = prevPliesWithoutCaptureOrPawnMove;
      this.turn = prevTurn;
      this.result = prevResult;
    }
  }

  setStartingData(fen: string) {
    let id = 0;
    const [piecesString, turnString, castlingString, enPassantString, pliesWithoutCaptureOrPawnMoveString] = fen.split(' ');
    const addPiece = (color: Color, pieceType: PieceType, x: number, y: number) => {
      const piece = {
        id: id++,
        color,
        type: pieceType,
        square: Game.squares[y][x]
      };

      this.pieces[color][piece.id] = piece;
      this.board[piece.square] = piece;
      this.position ^= this.pieceKeys[piece.color][piece.type][piece.square];
      this.pieceCounts[color]++;

      if (pieceType === PieceType.KING) {
        this.kings[color] = piece;
      } else {
        this.material[color] += Game.piecesWorth[pieceType];
      }
    };

    piecesString.split('/').reverse().forEach((row, y) => {
      let x = 0;

      row.split('').forEach((p) => {
        if (/\d/.test(p)) {
          x += +p;
        } else {
          if (Game.pieceLiterals[Color.WHITE].includes(p)) {
            addPiece(Color.WHITE, Game.pieceLiterals[Color.WHITE].indexOf(p), x, y);
          } else {
            addPiece(Color.BLACK, Game.pieceLiterals[Color.BLACK].indexOf(p), x, y);
          }

          x++;
        }
      });
    });

    this.turn = turnString === 'w'
      ? Color.WHITE
      : Color.BLACK;

    if (this.turn === Color.WHITE) {
      this.position ^= this.turnKey;
    }

    if (castlingString !== '-') {
      for (const side of castlingString) {
        this.possibleCastling |= Game.fenCastling[side];
      }

      this.position ^= this.castlingKeys[this.possibleCastling];
    }

    if (enPassantString !== '-') {
      this.possibleEnPassant = Game.literalToSquare(enPassantString);
      this.position ^= this.enPassantKeys[this.possibleEnPassant];
    }

    this.pliesWithoutCaptureOrPawnMove = +pliesWithoutCaptureOrPawnMoveString;
    this.isCheck = this.isInCheck(this.turn);
  }
}
