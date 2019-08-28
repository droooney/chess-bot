import * as _ from 'lodash';

import Utils, {
  Bitboards,
  Board,
  CastlingSide,
  Color,
  ColorPieces,
  Move,
  Piece,
  PieceType,
  Result
} from './Utils';

export enum GetPossibleMovesType {
  MOVE,
  ATTACKED
}

export default class Game extends Utils {
  static standardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
  bitboards: { [color in Color]: Bitboards; } = [
    new Bitboards(),
    new Bitboards()
  ];
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

  getAttacks(piece: Piece): bigint {
    if (piece.type === PieceType.BISHOP || piece.type === PieceType.ROOK || piece.type === PieceType.QUEEN) {
      const blockers = this.bitboards[Color.WHITE].all | this.bitboards[Color.BLACK].all;

      if (piece.type === PieceType.BISHOP || piece.type === PieceType.ROOK) {
        const { mask, map } = Game.slidingAttackBitboards[piece.type][piece.square];

        return map.get(blockers & mask)!;
      }

      const { mask: bishopMask, map: bishopMap } = Game.slidingAttackBitboards[PieceType.BISHOP][piece.square];
      const { mask: rookMask, map: rookMap } = Game.slidingAttackBitboards[PieceType.ROOK][piece.square];

      return bishopMap.get(blockers & bishopMask)! | rookMap.get(blockers & rookMask)!;
    }

    if (piece.type === PieceType.KNIGHT) {
      return Game.knightAttackBitboards[piece.square];
    }

    if (piece.type === PieceType.KING) {
      return Game.kingAttackBitboards[piece.square];
    }

    return Game.pawnAttackBitboards[piece.color][piece.square];
  }

  getLegalMoves(piece: Piece): number[] {
    const legalMoves: number[] = [];
    const possibleMoves = this.getPseudoLegalMoves(piece, GetPossibleMovesType.MOVE);
    const isPawn = piece.type === PieceType.PAWN;
    const prevSquare = piece.square;
    const enPassantCapturedPawn = this.possibleEnPassant && this.board[Game.pawnEnPassantPieceSquares[this.possibleEnPassant]];

    this.board[prevSquare] = null;

    for (let i = 0, l = possibleMoves.length; i < l; i++) {
      const square = possibleMoves[i];
      const capturedPiece = isPawn && square === this.possibleEnPassant
        ? enPassantCapturedPawn
        : this.board[square];

      if (capturedPiece) {
        this.board[capturedPiece.square] = null;

        delete this.pieces[capturedPiece.color][capturedPiece.id];
      }

      this.board[square] = piece;
      piece.square = square;

      if (!this.isInCheck()) {
        legalMoves.push(square);
      }

      this.board[square] = null;

      if (capturedPiece) {
        this.board[capturedPiece.square] = capturedPiece;
        this.pieces[capturedPiece.color][capturedPiece.id] = capturedPiece;
      }
    }

    this.board[prevSquare] = piece;
    piece.square = prevSquare;

    return legalMoves;
  }

  getLegalMoves2(piece: Piece): bigint {
    let square = 0;
    let legalBitboard = 0n;
    let capturedPiece: 0 | Piece | null = null;
    const bitboard = this.getPseudoLegalMoves2(piece);
    const isPawn = piece.type === PieceType.PAWN;
    const prevSquare = piece.square;
    const enPassantCapturedPawn = this.possibleEnPassant && this.board[Game.pawnEnPassantPieceSquares[this.possibleEnPassant]];

    this.bitboards[piece.color].all &= ~Game.squareBitboards[prevSquare];
    this.bitboards[piece.color][piece.type] &= ~Game.squareBitboards[prevSquare];

    for (; square < 64; square++) {
      if (bitboard & Game.squareBitboards[square]) {
        capturedPiece = isPawn && square === this.possibleEnPassant
          ? enPassantCapturedPawn
          : this.board[square];

        if (capturedPiece) {
          this.bitboards[capturedPiece.color].all &= ~Game.squareBitboards[capturedPiece.square];
          this.bitboards[capturedPiece.color][capturedPiece.type] &= ~Game.squareBitboards[capturedPiece.square];

          delete this.pieces[capturedPiece.color][capturedPiece.id];
        }

        this.bitboards[piece.color].all |= Game.squareBitboards[square];
        this.bitboards[piece.color][piece.type] |= Game.squareBitboards[square];
        piece.square = square;

        if (!this.isInCheck2()) {
          legalBitboard |= Game.squareBitboards[square];
        }

        this.bitboards[piece.color].all &= ~Game.squareBitboards[square];
        this.bitboards[piece.color][piece.type] &= ~Game.squareBitboards[square];

        if (capturedPiece) {
          this.bitboards[capturedPiece.color].all |= Game.squareBitboards[capturedPiece.square];
          this.bitboards[capturedPiece.color][capturedPiece.type] |= Game.squareBitboards[capturedPiece.square];
          this.pieces[capturedPiece.color][capturedPiece.id] = capturedPiece;
        }
      }
    }

    this.bitboards[piece.color].all |= Game.squareBitboards[prevSquare];
    this.bitboards[piece.color][piece.type] |= Game.squareBitboards[prevSquare];
    piece.square = prevSquare;

    return legalBitboard;
  }

  getPseudoLegalMoves(piece: Piece, type: GetPossibleMovesType): number[] {
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

          if (this.isSquareAttacked(newRookSquare)) {
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

  getPseudoLegalMoves2(piece: Piece): bigint {
    const {
      type: pieceType,
      color: pieceColor,
      square: pieceSquare
    } = piece;
    let bitboard = 0n;

    if (pieceType === PieceType.BISHOP || pieceType === PieceType.ROOK || pieceType === PieceType.QUEEN) {
      const blockers = this.bitboards[Color.WHITE].all | this.bitboards[Color.BLACK].all;

      if (pieceType === PieceType.BISHOP || pieceType === PieceType.ROOK) {
        const { mask, map } = Game.slidingAttackBitboards[pieceType][pieceSquare];

        bitboard = map.get(blockers & mask)!;
      } else {
        const { mask: bishopMask, map: bishopMap } = Game.slidingAttackBitboards[PieceType.BISHOP][pieceSquare];
        const { mask: rookMask, map: rookMap } = Game.slidingAttackBitboards[PieceType.ROOK][pieceSquare];

        bitboard = bishopMap.get(blockers & bishopMask)! | rookMap.get(blockers & rookMask)!;
      }
    } else if (pieceType === PieceType.KNIGHT) {
      bitboard = Game.knightAttackBitboards[pieceSquare];
    } else if (pieceType === PieceType.KING) {
      bitboard = Game.kingAttackBitboards[pieceSquare];

      if (pieceSquare === Game.kingInitialSquares[pieceColor] && !this.isCheck) {
        const castlings: CastlingSide[] = [];

        if (this.possibleCastling & Game.castling[pieceColor][CastlingSide.KING]) {
          castlings.push(CastlingSide.KING);
        }

        if (this.possibleCastling & Game.castling[pieceColor][CastlingSide.QUEEN]) {
          castlings.push(CastlingSide.QUEEN);
        }

        if (castlings.length) {
          const blockers = this.bitboards[Color.WHITE].all | this.bitboards[Color.BLACK].all;

          for (let i = 0, l = castlings.length; i < l; i++) {
            const {
              newRookSquare,
              newKingSquare,
              middleSquares
            } = Game.castlingParams2[pieceColor][castlings[i]];

            if (blockers & middleSquares) {
              continue;
            }

            if (this.isSquareAttacked2(newRookSquare)) {
              continue;
            }

            bitboard |= newKingSquare;
          }
        }
      }
    } else {
      const blockers = this.bitboards[Color.WHITE].all | this.bitboards[Color.BLACK].all;
      const { mask, map } = Game.pawnAdvanceBitboards[pieceColor][pieceSquare];

      bitboard = map.get(blockers & mask)!;

      if (this.possibleEnPassant) {
        bitboard |= Game.squareBitboards[this.possibleEnPassant];
      }

      const pawnAttacks = Game.pawnAttackBitboards[pieceColor][pieceSquare];

      bitboard |= pawnAttacks & this.bitboards[Game.oppositeColor[pieceColor]].all;
    }

    return bitboard & ~this.bitboards[pieceColor].all;
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

  isInCheck(): boolean {
    return this.isSquareAttacked(this.kings[this.turn].square);
  }

  isInCheck2(): boolean {
    return this.isSquareAttacked2(Game.squareBitboards[this.kings[this.turn].square]);
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
        possibleBishopColor = Game.colors[piece.square];
      } else if (Game.colors[piece.square] !== possibleBishopColor) {
        return false;
      }
    }

    for (const pieceId in minPieces) {
      const piece = minPieces[pieceId];

      if (piece.type === PieceType.KING) {
        continue;
      }

      if (piece.type !== PieceType.BISHOP || Game.colors[piece.square] !== possibleBishopColor) {
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

  isSquareAttacked(square: number): boolean {
    const pieces = this.pieces[Game.oppositeColor[this.turn]];

    for (const pieceId in pieces) {
      const pseudoLegalMoves = this.getPseudoLegalMoves(pieces[pieceId], GetPossibleMovesType.ATTACKED);

      for (let i = 0, l = pseudoLegalMoves.length; i < l; i++) {
        if (pseudoLegalMoves[i] === square) {
          return true;
        }
      }
    }

    return false;
  }

  isSquareAttacked2(squareBitboard: bigint): boolean {
    const pieces = this.pieces[Game.oppositeColor[this.turn]];

    for (const pieceId in pieces) {
      if (this.getAttacks(pieces[pieceId]) & squareBitboard) {
        return true;
      }
    }

    return false;
  }

  isStalemate(): boolean {
    return !this.isCheck && this.isNoMoves();
  }

  movePiece(piece: Piece, square: number, changePosition: boolean) {
    if (changePosition) {
      this.position ^= this.pieceKeys[piece.color][piece.type][piece.square];
      this.position ^= this.pieceKeys[piece.color][piece.type][square];
    }

    this.bitboards[piece.color].all &= ~Game.squareBitboards[piece.square];
    this.bitboards[piece.color][piece.type] &= ~Game.squareBitboards[piece.square];
    this.board[piece.square] = null;

    this.bitboards[piece.color].all |= Game.squareBitboards[square];
    this.bitboards[piece.color][piece.type] |= Game.squareBitboards[square];
    this.board[square] = piece;

    piece.square = square;
  }

  performMove(move: number): Move {
    const from = move >> 9;
    const to = move >> 3 & 63;
    const promotion: PieceType = move & 7;
    const piece = this.board[from]!;
    const {
      type: pieceType,
      color: pieceColor
    } = piece;
    const opponentColor = Game.oppositeColor[this.turn];
    const wasCheck = this.isCheck;
    const prevPosition = this.position;
    const prevPossibleEnPassant = this.possibleEnPassant;
    const prevPossibleCastling = this.possibleCastling;
    const prevPliesWithoutCaptureOrPawnMove = this.pliesWithoutCaptureOrPawnMove;
    const isEnPassantCapture = pieceType === PieceType.PAWN && to === this.possibleEnPassant;
    const capturedPiece = isEnPassantCapture
      ? this.board[Game.pawnEnPassantPieceSquares[to]]
      : this.board[to];
    let castlingRook: Piece | null = null;

    this.movePiece(piece, to, true);

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

      this.movePiece(rook, newRookSquare, true);

      castlingRook = rook;
    }

    if (capturedPiece) {
      this.removePiece(capturedPiece, isEnPassantCapture);

      if (capturedPiece.type === PieceType.ROOK && capturedPiece.square in Game.rookCastlingSides) {
        this.possibleCastling &= ~Game.castling[opponentColor][Game.rookCastlingSides[capturedPiece.square]];
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
      this.bitboards[pieceColor][PieceType.PAWN] &= ~Game.squareBitboards[to];
      this.bitboards[pieceColor][promotion] |= Game.squareBitboards[to];
    }

    if (pieceType === PieceType.PAWN && Game.pawnDoubleAdvanceMoves[pieceColor][from] === to) {
      const leftPiece = this.board[Game.pawnEnPassantOpponentPawnSquares[to][0]];
      const rightPiece = this.board[Game.pawnEnPassantOpponentPawnSquares[to][0]];

      if ((
        leftPiece
        && leftPiece.type === PieceType.PAWN
        && leftPiece.color === opponentColor
      ) || (
        rightPiece
        && rightPiece.type === PieceType.PAWN
        && rightPiece.color === opponentColor
      )) {
        const enPassantSquare = Game.pawnEnPassantSquaresMap[from];

        this.possibleEnPassant = enPassantSquare;
        this.position ^= this.enPassantKeys[enPassantSquare];
      } else {
        this.possibleEnPassant = null;
      }
    } else {
      this.possibleEnPassant = null;
    }

    this.position ^= this.turnKey;
    this.position ^= this.castlingKeys[prevPossibleCastling];
    this.position ^= this.castlingKeys[this.possibleCastling];

    if (prevPossibleEnPassant) {
      this.position ^= this.enPassantKeys[prevPossibleEnPassant];
    }

    this.turn = opponentColor;
    this.isCheck = this.isInCheck();
    this.positions.set(this.position, this.positions.get(this.position)! + 1 || 1);

    if (this.isCheckmate()) {
      this.result = pieceColor as 0 | 1;
    } else if (this.isDraw()) {
      this.result = Result.DRAW;
    }

    return {
      move,
      capturedPiece,
      castlingRook,
      wasCheck,
      prevPosition,
      prevPossibleEnPassant,
      prevPossibleCastling,
      prevPliesWithoutCaptureOrPawnMove
    };
  }

  putPiece(piece: Piece, square: number, changePosition: boolean) {
    this.pieces[piece.color][piece.id] = piece;
    this.pieceCounts[piece.color]++;
    this.board[piece.square] = piece;
    this.material[piece.color] += Game.piecesWorth[piece.type];
    this.bitboards[piece.color].all |= Game.squareBitboards[square];
    this.bitboards[piece.color][piece.type] |= Game.squareBitboards[square];

    if (changePosition) {
      this.position ^= this.pieceKeys[piece.color][piece.type][piece.square];
    }
  }

  removePiece(piece: Piece, removeFromBoard: boolean) {
    delete this.pieces[piece.color][piece.id];

    this.pieceCounts[piece.color]--;
    this.material[piece.color] -= Game.piecesWorth[piece.type];
    this.bitboards[piece.color].all &= ~Game.squareBitboards[piece.square];
    this.bitboards[piece.color][piece.type] &= ~Game.squareBitboards[piece.square];

    if (removeFromBoard) {
      this.board[piece.square] = null;
      this.position ^= this.pieceKeys[piece.color][piece.type][piece.square];
    }
  }

  revertMove(move: Move) {
    const prevTurn = Game.oppositeColor[this.turn];
    const {
      move: moveNumber,
      capturedPiece,
      castlingRook,
      wasCheck,
      prevPosition,
      prevPossibleEnPassant,
      prevPossibleCastling,
      prevPliesWithoutCaptureOrPawnMove
    } = move;
    const from = moveNumber >> 9;
    const to = moveNumber >> 3 & 63;
    const promotion: PieceType = moveNumber & 7;
    const piece = this.board[to]!;

    this.movePiece(piece, from, false);

    if (capturedPiece) {
      this.putPiece(capturedPiece, capturedPiece.square, false);
    }

    if (promotion) {
      this.material[piece.color] -= Game.piecesWorth[piece.type] - Game.piecesWorth[PieceType.PAWN];
      this.bitboards[piece.color][piece.type] &= ~Game.squareBitboards[to];
      this.bitboards[piece.color][PieceType.PAWN] |= Game.squareBitboards[to];
      piece.type = PieceType.PAWN;
    }

    if (castlingRook) {
      this.movePiece(castlingRook, Game.rookInitialSquares[castlingRook.square], false);
    }

    this.isCheck = wasCheck;

    const positionCount = this.positions.get(this.position)!;

    if (positionCount === 1) {
      this.positions.delete(this.position);
    } else {
      this.positions.set(this.position, positionCount - 1);
    }

    this.position = prevPosition;
    this.possibleEnPassant = prevPossibleEnPassant;
    this.possibleCastling = prevPossibleCastling;
    this.pliesWithoutCaptureOrPawnMove = prevPliesWithoutCaptureOrPawnMove;
    this.turn = prevTurn;
    this.result = null;
  }

  setStartingData(fen: string) {
    let id = 0;
    const [piecesString, turnString, castlingString, enPassantString, pliesWithoutCaptureOrPawnMoveString] = fen.split(' ');
    const addPiece = (color: Color, type: PieceType, file: number, rank: number) => {
      const square = Game.squares[rank][file];
      const piece: Piece = {
        id: id++,
        color,
        type,
        square
      };

      this.putPiece(piece, square, true);

      if (type === PieceType.KING) {
        this.kings[color] = piece;
      }
    };

    piecesString.split('/').reverse().forEach((row, rank) => {
      let file = 0;

      row.split('').forEach((p) => {
        if (/\d/.test(p)) {
          file += +p;
        } else {
          if (Game.pieceLiterals[Color.WHITE].includes(p)) {
            addPiece(Color.WHITE, Game.pieceLiterals[Color.WHITE].indexOf(p), file, rank);
          } else {
            addPiece(Color.BLACK, Game.pieceLiterals[Color.BLACK].indexOf(p), file, rank);
          }

          file++;
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
    this.isCheck = this.isInCheck();
    this.positions.set(this.position, 1);
  }
}
