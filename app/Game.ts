import * as _ from 'lodash';

import Utils, {
  Board,
  CastlingSide,
  Color,
  Move,
  Piece,
  PieceType,
  PinnedDirection
} from './Utils';

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
  isDraw: boolean = false;
  isCheck: boolean = false;
  isDoubleCheck: boolean = false;
  checkingPiece: Piece | null = null;
  board: Board = Game.allSquares.map(() => null);
  kings: Record<Color, Piece> = [null!, null!];
  keys: Record<string, boolean> = {};
  pieces: Record<Color, Piece[]> = [[], []];
  pieceCounts: Record<Color, number> = [0, 0];
  bishopsCount: number = 0;
  pawnCount: number = 0;
  material: Record<Color, number> = [0, 0];
  positionKey: bigint = 0n;
  pawnKey: bigint = 0n;
  positions: bigint[] = [];
  possibleCastling: number = 0;
  possibleEnPassant: number | null = null;
  pliesWithoutCaptureOrPawnMove: number = 0;
  turnKey = this.generateKey();
  castlingKeys: bigint[] = new Array(16).fill(0).map(this.generateKey);
  enPassantKeys: Record<number, bigint> = _.mapValues(Game.pawnEnPassantSquares, this.generateKey);
  pieceKeys: Record<Color, Record<PieceType, bigint[]>> = [
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
  notOwnPiece: Record<Color, (square: number) => boolean> = [
    (square) => !this.board[square] || this.board[square]!.color !== Color.WHITE,
    (square) => !this.board[square] || this.board[square]!.color !== Color.BLACK
  ];
  moves: number[] = [];

  constructor(fen: string) {
    super();

    this.setStartingData(fen);
  }

  getAllLegalMoves(): number[] {
    const moves: number[] = [];
    const pieces = this.pieces[this.turn];
    const pieceCount = this.pieceCounts[this.turn];

    for (let i = 0; i < pieceCount; i++) {
      const piece = pieces[i];
      const legalMoves = this.getLegalMoves(piece, false);

      for (let i = 0; i < legalMoves.length; i++) {
        const square = legalMoves[i];
        const move = Game.moves[piece.square][square];

        if (piece.type === PieceType.PAWN && Game.promotionSquaresSet[this.turn].has(square)) {
          moves.push(move + PieceType.QUEEN);
          moves.push(move + PieceType.KNIGHT);
          moves.push(move + PieceType.ROOK);
          moves.push(move + PieceType.BISHOP);
        } else {
          moves.push(move);
        }
      }
    }

    return moves;
  }

  getAttacks(piece: Piece): number[] {
    if (piece.type === PieceType.KNIGHT) {
      return Game.knightMoves[piece.square];
    }

    if (piece.type === PieceType.KING) {
      return Game.kingMoves[piece.square];
    }

    if (piece.type === PieceType.PAWN) {
      return Game.pawnAttacks[piece.color][piece.square];
    }

    const attacks: number[] = [];
    const pieceAttacks = Game.slidingAttacks[piece.type][piece.square];

    for (let i = 0; i < pieceAttacks.length; i++) {
      const directionAttacks = pieceAttacks[i];

      for (let i = 0; i < directionAttacks.length; i++) {
        const square = directionAttacks[i];
        const pieceInSquare = this.board[square];

        attacks.push(square);

        if (pieceInSquare) {
          break;
        }
      }
    }

    return attacks;
  }

  getCheckingPiece(): Piece | null {
    const pieces = this.pieces[Game.oppositeColor[this.turn]];
    const pieceCount = this.pieceCounts[Game.oppositeColor[this.turn]];

    for (let i = 0; i < pieceCount; i++) {
      const piece = pieces[i];

      if (this.getAttacks(piece).includes(this.kings[this.turn].square)) {
        return piece;
      }
    }

    return null;
  }

  getLegalMoves(piece: Piece, stopAfter1: boolean): number[] {
    const isKing = piece.type === PieceType.KING;

    if (this.isDoubleCheck && !isKing) {
      return [];
    }

    const kingSquare = this.kings[this.turn].square;
    const opponentColor = Game.oppositeColor[piece.color];
    const isPawn = piece.type === PieceType.PAWN;

    let isPinned = false;
    let isEnPassantPinned = false;
    let pinnedDirection;
    let pinnedDirectionSquaresSet: Set<number> | null = null;

    if (Game.isAligned[piece.square][kingSquare] && this.getSliderBehind(kingSquare, piece.square, opponentColor)) {
      isPinned = !this.isDirectionBlocked(piece.square, kingSquare);

      if (isPinned) {
        pinnedDirection = Game.isAlignedDiagonally[piece.square][kingSquare]
          ? PinnedDirection.DIAGONAL
          : Game.squareRanks[piece.square] === Game.squareRanks[kingSquare]
            ? PinnedDirection.HORIZONTAL
            : PinnedDirection.VERTICAL;
        pinnedDirectionSquaresSet = Game.behindAndMiddleSquaresSet[kingSquare][piece.square];
      }
    }

    if (!isPinned && isPawn && this.possibleEnPassant && Game.pawnAttacksSet[piece.color][piece.square].has(this.possibleEnPassant)) {
      const capturedPawn = this.board[Game.pawnEnPassantPieceSquares[this.possibleEnPassant]]!;

      this.board[capturedPawn.square] = null;

      isEnPassantPinned = (
        !!this.getSliderBehind(kingSquare, piece.square, opponentColor)
        && !this.isDirectionBlocked(piece.square, kingSquare)
      );

      this.board[capturedPawn.square] = capturedPawn;
    }

    if (isPinned && this.isCheck) {
      return [];
    }

    if (
      isPinned
      && (
        piece.type === PieceType.KNIGHT
        || (
          pinnedDirection === PinnedDirection.DIAGONAL
          && piece.type === PieceType.ROOK
        )
        || (
          pinnedDirection === PinnedDirection.HORIZONTAL
          && piece.type === PieceType.PAWN
        )
        || (
          (pinnedDirection === PinnedDirection.HORIZONTAL || pinnedDirection === PinnedDirection.VERTICAL)
          && piece.type === PieceType.BISHOP
        )
      )
    ) {
      return [];
    }

    const possibleMoves = this.getPseudoLegalMoves(piece);
    const isNoCheckAndNotPinned = !this.isCheck && !isKing && !isPinned;

    if (isNoCheckAndNotPinned && (!isPawn || !isEnPassantPinned)) {
      return possibleMoves;
    }

    const legalMoves: number[] = [];
    const prevSquare = piece.square;

    this.board[prevSquare] = null;

    for (let i = 0, l = possibleMoves.length; i < l; i++) {
      const square = possibleMoves[i];
      const isEnPassantCapture = isPawn && this.possibleEnPassant && square === this.possibleEnPassant;

      if (isEnPassantCapture && isEnPassantPinned) {
        continue;
      }

      if (this.isCheck && !isKing) {
        const capturedPieceSquare = isEnPassantCapture ? Game.pawnEnPassantPieceSquares[square] : square;

        if (
          // not capturing checking piece
          capturedPieceSquare !== (this.checkingPiece!.square)
          && (
            // and not blocking slider checker
            !(this.checkingPiece!.type in Game.sliders)
            || !Game.middleSquaresSet[kingSquare][this.checkingPiece!.square].has(square)
          )
        ) {
          continue;
        }
      }

      if (!isKing) {
        if (!isPinned || pinnedDirectionSquaresSet!.has(square)) {
          legalMoves.push(square);

          if (stopAfter1) {
            break;
          }
        }

        continue;
      }

      const capturedPiece = this.board[square];

      if (capturedPiece) {
        const opponentPieces = this.pieces[opponentColor];

        (opponentPieces[capturedPiece.index] = opponentPieces[--this.pieceCounts[opponentColor]]).index = capturedPiece.index;

        this.board[capturedPiece.square] = null;
      }

      this.board[square] = piece;
      piece.square = square;

      if (!this.isInCheck()) {
        legalMoves.push(square);
      }

      this.board[square] = null;

      if (capturedPiece) {
        const opponentPieces = this.pieces[opponentColor];

        opponentPieces[capturedPiece.index].index = this.pieceCounts[opponentColor]++;
        opponentPieces[capturedPiece.index] = capturedPiece;

        this.board[capturedPiece.square] = capturedPiece;
      }

      if (stopAfter1 && legalMoves.length) {
        break;
      }
    }

    this.board[prevSquare] = piece;
    piece.square = prevSquare;

    return legalMoves;
  }

  getPseudoLegalMoves(piece: Piece): number[] {
    if (piece.type === PieceType.BISHOP || piece.type === PieceType.ROOK || piece.type === PieceType.QUEEN) {
      const moves: number[] = [];
      const pieceMoves = Game.slidingAttacks[piece.type][piece.square];

      for (let i = 0, l = pieceMoves.length; i < l; i++) {
        const directionMoves = pieceMoves[i];

        for (let i = 0, l = directionMoves.length; i < l; i++) {
          const square = directionMoves[i];
          const pieceInSquare = this.board[square];

          if (pieceInSquare) {
            if (pieceInSquare.color !== piece.color) {
              moves.push(square);
            }

            break;
          } else {
            moves.push(square);
          }
        }
      }

      return moves;
    }

    if (piece.type === PieceType.KNIGHT) {
      return this.getAttacks(piece).filter(this.notOwnPiece[piece.color]);
    }

    if (piece.type === PieceType.KING) {
      const moves = this.getAttacks(piece).filter(this.notOwnPiece[piece.color]);

      if (piece.square === Game.kingInitialSquares[piece.color] && !this.isCheck) {
        const castlings: CastlingSide[] = [];

        if (this.possibleCastling & Game.castling[piece.color][CastlingSide.KING]) {
          castlings.push(CastlingSide.KING);
        }

        if (this.possibleCastling & Game.castling[piece.color][CastlingSide.QUEEN]) {
          castlings.push(CastlingSide.QUEEN);
        }

        if (castlings.length) {
          castling: for (let i = 0, l = castlings.length; i < l; i++) {
            const {
              newRookSquare,
              newKingSquare,
              middleSquares
            } = Game.castlingParams[piece.color][castlings[i]];

            for (let i = 0, l = middleSquares.length; i < l; i++) {
              if (this.board[middleSquares[i]]) {
                continue castling;
              }
            }

            if (this.isSquareAttacked(newRookSquare)) {
              continue;
            }

            moves.push(newKingSquare);
          }
        }
      }

      return moves;
    }

    const moves: number[] = [];
    const advanceMoves = Game.pawnAdvanceMoves[piece.color][piece.square];

    for (let i = 0, l = advanceMoves.length; i < l; i++) {
      const square = advanceMoves[i];
      const pieceInSquare = this.board[square];

      if (pieceInSquare) {
        break;
      }

      moves.push(square);
    }

    const captureMoves = Game.pawnAttacks[piece.color][piece.square];

    for (let i = 0, l = captureMoves.length; i < l; i++) {
      const square = captureMoves[i];

      if (this.possibleEnPassant === square) {
        moves.push(square);

        continue;
      }

      const pieceInSquare = this.board[square];

      if (pieceInSquare && pieceInSquare.color !== piece.color) {
        moves.push(square);
      }
    }

    return moves;
  }

  getSliderBehind(square1: number, square2: number, color: Color): Piece | null {
    const behindSquares = Game.behindSquares[square1][square2];
    const sliders = Game.isAlignedDiagonally[square1][square2]
      ? Game.diagonalSliders
      : Game.orthogonalSliders;

    for (let i = 0; i < behindSquares.length; i++) {
      const behindPiece = this.board[behindSquares[i]];

      if (behindPiece) {
        if (behindPiece.color === color && behindPiece.type in sliders) {
          return behindPiece;
        }

        break;
      }
    }

    return null;
  }

  isControlledByOpponentPawn(square: number, opponentColor: Color): boolean {
    const attackingPawnSquares = Game.pawnAttacks[Game.oppositeColor[opponentColor]][square];
    const leftPawn = this.board[attackingPawnSquares[0]];
    const rightPawn = this.board[attackingPawnSquares[1]];

    return (
      (!!leftPawn && leftPawn.type === PieceType.PAWN && leftPawn.color === opponentColor)
      || (!!rightPawn && rightPawn.type === PieceType.PAWN && rightPawn.color === opponentColor)
    );
  }

  isDirectionBlocked(square1: number, square2: number): boolean {
    const middleSquares = Game.middleSquares[square1][square2];

    for (let i = 0, l = middleSquares.length; i < l; i++) {
      if (this.board[middleSquares[i]]) {
        return true;
      }
    }

    return false;
  }

  isEndgame(): boolean {
    return (
      this.pawnCount < 5
      || this.pieceCounts[Color.WHITE] + this.pieceCounts[Color.BLACK] - this.pawnCount < 9
    );
  }

  isInCheck(): boolean {
    return this.isSquareAttacked(this.kings[this.turn].square);
  }

  isInDoubleCheck(): boolean {
    const pieces = this.pieces[Game.oppositeColor[this.turn]];
    const pieceCount = this.pieceCounts[Game.oppositeColor[this.turn]];
    let checkingPiecesCount = 0;

    for (let i = 0; i < pieceCount; i++) {
      const piece = pieces[i];

      if (this.getAttacks(piece).includes(this.kings[this.turn].square)) {
        checkingPiecesCount++;
      }
    }

    return checkingPiecesCount === 2;
  }

  isInsufficientMaterial(): boolean {
    const whiteHasMore = this.pieceCounts[Color.WHITE] > this.pieceCounts[Color.BLACK];
    const minPiecesColor = whiteHasMore
      ? Color.BLACK
      : Color.WHITE;
    const maxPiecesColor = Game.oppositeColor[minPiecesColor];
    const maxPieceCount = this.pieceCounts[maxPiecesColor];

    // king vs king
    if (maxPieceCount === 1) {
      return true;
    }

    const maxPieces = this.pieces[maxPiecesColor];
    const minPieceCount = this.pieceCounts[minPiecesColor];

    if (minPieceCount === 1 && maxPieceCount === 2) {
      const notKing = maxPieces[0].type === PieceType.KING ? maxPieces[1] : maxPieces[0];

      return notKing.type === PieceType.KNIGHT || notKing.type === PieceType.BISHOP;
    }

    if (this.bishopsCount !== this.pieceCounts[Color.WHITE] + this.pieceCounts[Color.BLACK] - 2) {
      return false;
    }

    const possibleBishopColor = Game.colors[(maxPieces[0].type === PieceType.BISHOP ? maxPieces[0] : maxPieces[1]).square];

    for (let i = 0; i < maxPieceCount; i++) {
      const piece = maxPieces[i];

      if (piece.type === PieceType.BISHOP && Game.colors[piece.square] !== possibleBishopColor) {
        return false;
      }
    }

    const minPieces = this.pieces[minPiecesColor];

    for (let i = 0; i < minPieceCount; i++) {
      const piece = minPieces[i];

      if (piece.type === PieceType.BISHOP && Game.colors[piece.square] !== possibleBishopColor) {
        return false;
      }
    }

    return true;
  }

  isNoMoves(): boolean {
    const pieces = this.pieces[this.turn];
    const pieceCount = this.pieceCounts[this.turn];

    for (let i = 0; i < pieceCount; i++) {
      if (this.getLegalMoves(pieces[i], true).length) {
        return false;
      }
    }

    return true;
  }

  isSquareAttacked(square: number): boolean {
    const opponentColor = Game.oppositeColor[this.turn];

    if (Game.kingAttacksSet[this.kings[opponentColor].square].has(square)) {
      return true;
    }

    if (this.isControlledByOpponentPawn(square, opponentColor)) {
      return true;
    }

    const knightAttacks = Game.knightMoves[square];

    for (let i = 0; i < knightAttacks.length; i++) {
      const pieceInSquare = this.board[knightAttacks[i]];

      if (pieceInSquare && pieceInSquare.color === opponentColor && pieceInSquare.type === PieceType.KNIGHT) {
        return true;
      }
    }

    const bishopDirections = Game.slidingAttacks[PieceType.BISHOP][square];

    for (let i = 0; i < bishopDirections.length; i++) {
      const direction = bishopDirections[i];

      for (let i = 0; i < direction.length; i++) {
        const pieceInSquare = this.board[direction[i]];

        if (pieceInSquare) {
          if (pieceInSquare.color === opponentColor && (pieceInSquare.type === PieceType.BISHOP || pieceInSquare.type === PieceType.QUEEN)) {
            return true;
          }

          break;
        }
      }
    }

    const rookDirections = Game.slidingAttacks[PieceType.ROOK][square];

    for (let i = 0; i < rookDirections.length; i++) {
      const direction = rookDirections[i];

      for (let i = 0; i < direction.length; i++) {
        const pieceInSquare = this.board[direction[i]];

        if (pieceInSquare) {
          if (pieceInSquare.color === opponentColor && (pieceInSquare.type === PieceType.ROOK || pieceInSquare.type === PieceType.QUEEN)) {
            return true;
          }

          break;
        }
      }
    }

    /*
    const pieces = this.pieces[opponentColor];
    const pieceCount = this.pieceCounts[opponentColor];

    for (let i = 0; i < pieceCount; i++) {
      const piece = pieces[i];

      if (piece.type === PieceType.KING || piece.type === PieceType.KNIGHT || piece.type === PieceType.PAWN) {
        if (
          (
            piece.type === PieceType.KING
              ? Game.kingAttacksSet[piece.square]
              : piece.type === PieceType.KNIGHT
                ? Game.knightAttacksSet[piece.square]
                : Game.pawnAttacksSet[piece.color][piece.square]
          ).has(square)
        ) {
          return true;
        }
      } else {
        if (Game.isPieceAligned[square][piece.square][piece.type] && !this.isDirectionBlocked(piece.square, square)) {
          return true;
        }
      }
    }
    */

    return false;
  }

  performMove(move: number): Move {
    // this.moves.push(move);

    const from = Game.movesFrom[move];
    const to = Game.movesTo[move];
    const promotion: PieceType = move & 7;
    const piece = this.board[from]!;
    const pieceType = piece.type;
    const pieceColor = piece.color;
    const opponentColor = Game.oppositeColor[this.turn];
    const wasCheck = this.isCheck;
    const wasDoubleCheck = this.isDoubleCheck;
    const prevCheckingPiece = this.checkingPiece;
    const prevPositionKey = this.positionKey;
    const prevPawnKey = this.pawnKey;
    const prevPossibleEnPassant = this.possibleEnPassant;
    const prevPossibleCastling = this.possibleCastling;
    const prevPliesWithoutCaptureOrPawnMove = this.pliesWithoutCaptureOrPawnMove;
    const isEnPassantCapture = pieceType === PieceType.PAWN && to === this.possibleEnPassant;
    const capturedPiece = this.board[isEnPassantCapture ? Game.pawnEnPassantPieceSquares[to] : to];
    let checkingPiece: Piece | null = null;
    let castlingRook: Piece | null = null;
    const positionPieceKeyChange = this.pieceKeys[pieceColor][pieceType][from] ^ this.pieceKeys[pieceColor][pieceType][to];

    this.positionKey ^= positionPieceKeyChange;

    if (pieceType === PieceType.PAWN) {
      this.pawnKey ^= positionPieceKeyChange;
    }

    this.board[from] = null;
    this.board[to] = piece;

    piece.square = to;

    if (pieceType === PieceType.KING) {
      this.possibleCastling &= (
        ~Game.castling[pieceColor][CastlingSide.KING]
        & ~Game.castling[pieceColor][CastlingSide.QUEEN]
      );
    }

    if (pieceType === PieceType.ROOK && from in Game.rookCastlingPermissions) {
      this.possibleCastling &= ~Game.rookCastlingPermissions[from];
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

      this.positionKey ^= this.pieceKeys[rook.color][rook.type][rook.square] ^ this.pieceKeys[rook.color][rook.type][newRookSquare];

      this.board[rook.square] = null;
      this.board[newRookSquare] = rook;

      rook.square = newRookSquare;

      castlingRook = rook;
    }

    if (capturedPiece) {
      const opponentPieces = this.pieces[opponentColor];

      (opponentPieces[capturedPiece.index] = opponentPieces[--this.pieceCounts[opponentColor]]).index = capturedPiece.index;

      this.material[capturedPiece.color] -= Game.piecesWorth[capturedPiece.type];
      this.positionKey ^= this.pieceKeys[capturedPiece.color][capturedPiece.type][capturedPiece.square];

      if (isEnPassantCapture) {
        this.board[capturedPiece.square] = null;
      }

      if (capturedPiece.type === PieceType.ROOK && capturedPiece.square in Game.rookCastlingPermissions) {
        this.possibleCastling &= ~Game.rookCastlingPermissions[capturedPiece.square];
      } else if (capturedPiece.type === PieceType.BISHOP) {
        this.bishopsCount--;
      } else if (capturedPiece.type === PieceType.PAWN) {
        this.pawnKey ^= this.pieceKeys[capturedPiece.color][capturedPiece.type][capturedPiece.square];
        this.pawnCount--;
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
      this.positionKey ^= this.pieceKeys[pieceColor][PieceType.PAWN][to] ^ this.pieceKeys[pieceColor][promotion][to];
      this.pawnKey ^= this.pieceKeys[pieceColor][PieceType.PAWN][to];
      this.pawnCount--;
    }

    if (pieceType === PieceType.PAWN && Game.pawnDoubleAdvanceMoves[pieceColor][from] === to) {
      const opponentPawnSquares = Game.pawnEnPassantOpponentPawnSquares.get(to)!;
      const leftPiece = this.board[opponentPawnSquares[0]];
      const rightPiece = this.board[opponentPawnSquares[1]];

      if ((
        leftPiece
        && leftPiece.type === PieceType.PAWN
        && leftPiece.color === opponentColor
      ) || (
        rightPiece
        && rightPiece.type === PieceType.PAWN
        && rightPiece.color === opponentColor
      )) {
        const enPassantSquare = Game.pawnEnPassantSquaresMap.get(from)!;

        this.possibleEnPassant = enPassantSquare;
        this.positionKey ^= this.enPassantKeys[enPassantSquare];
      } else {
        this.possibleEnPassant = null;
      }
    } else {
      this.possibleEnPassant = null;
    }

    this.positionKey ^= this.turnKey ^ this.castlingKeys[prevPossibleCastling] ^ this.castlingKeys[this.possibleCastling];

    if (prevPossibleEnPassant) {
      this.positionKey ^= this.enPassantKeys[prevPossibleEnPassant];
    }

    let isCheck = false;
    let isNormalCheck = false;
    let isDiscoveredCheck = false;
    let isEnPassantDiscoveredCheck = false;
    const opponentKingSquare = this.kings[opponentColor].square;
    const possibleNormalCheckingPiece = castlingRook || piece;
    const checkingPieceType = possibleNormalCheckingPiece.type;

    if (checkingPieceType === PieceType.KNIGHT || checkingPieceType === PieceType.PAWN) {
      isCheck = isNormalCheck = (
        checkingPieceType === PieceType.KNIGHT
          ? Game.knightAttacksSet[to]
          : Game.pawnAttacksSet[pieceColor][to]
      ).has(opponentKingSquare);

      if (isCheck) {
        checkingPiece = possibleNormalCheckingPiece;
      }
    } else if (checkingPieceType !== PieceType.KING) {
      if (
        Game.isPieceAligned[possibleNormalCheckingPiece.square][opponentKingSquare][checkingPieceType]
        && (!Game.isOnOneLine[from][to][opponentKingSquare] || capturedPiece || castlingRook || promotion)
      ) {
        isNormalCheck = !this.isDirectionBlocked(possibleNormalCheckingPiece.square, opponentKingSquare);

        if (isNormalCheck) {
          isCheck = true;
          checkingPiece = possibleNormalCheckingPiece;
        }
      }
    }

    if (
      pieceType !== PieceType.QUEEN
      && (
        (Game.isAlignedDiagonally[from][opponentKingSquare] && pieceType !== PieceType.BISHOP)
        || (Game.isAlignedOrthogonally[from][opponentKingSquare] && pieceType !== PieceType.ROOK)
      )
      && !Game.isOnOneLine[from][to][opponentKingSquare]
      && !castlingRook
    ) {
      const sliderBehind = this.getSliderBehind(opponentKingSquare, from, pieceColor);

      if (sliderBehind) {
        isDiscoveredCheck = !this.isDirectionBlocked(from, opponentKingSquare);

        if (isDiscoveredCheck) {
          isCheck = true;
          checkingPiece = sliderBehind;
        }
      }
    }

    if (!isNormalCheck && isEnPassantCapture && Game.isAlignedDiagonally[opponentKingSquare][capturedPiece!.square]) {
      const sliderBehind = this.getSliderBehind(opponentKingSquare, capturedPiece!.square, pieceColor);

      if (sliderBehind) {
        isEnPassantDiscoveredCheck = !this.isDirectionBlocked(capturedPiece!.square, opponentKingSquare);

        if (isEnPassantDiscoveredCheck) {
          isCheck = true;
          checkingPiece = sliderBehind;
        }
      }
    }

    let prevPositionCount = 0;

    for (let i = this.positions.length - this.pliesWithoutCaptureOrPawnMove - 1; i < this.positions.length; i++) {
      if (this.positions[i] === this.positionKey) {
        prevPositionCount++;
      }
    }

    this.turn = opponentColor;
    this.isCheck = isCheck;
    this.isDoubleCheck = (isNormalCheck || isEnPassantDiscoveredCheck) && isDiscoveredCheck;
    this.checkingPiece = checkingPiece;
    this.positions.push(this.positionKey);

    if (
      this.pliesWithoutCaptureOrPawnMove >= 100
      || prevPositionCount >= 2
      || this.isInsufficientMaterial()
    ) {
      this.isDraw = true;
    }

    return {
      move,
      movedPiece: piece,
      capturedPiece,
      castlingRook,
      wasCheck,
      wasDoubleCheck,
      prevCheckingPiece,
      prevPositionKey,
      prevPawnKey,
      prevPossibleEnPassant,
      prevPossibleCastling,
      prevPliesWithoutCaptureOrPawnMove
    };
  }

  printBoard(): string {
    const rows: string[][] = [];

    for (let i = 0; i < 8; i++) {
      rows.push([]);

      for (let j = 0; j < 8; j++) {
        const square = i << 3 | j;

        rows[i][j] = this.board[square]
          ? Game.pieceLiterals[this.board[square]!.color][this.board[square]!.type]
          : '.';
      }
    }

    return rows.reverse().map((row) => row.join('  ')).join('\n') + '\n';
  }

  revertMove(move: Move) {
    // this.moves.pop();

    const prevTurn = Game.oppositeColor[this.turn];
    const {
      movedPiece,
      capturedPiece,
      castlingRook
    } = move;
    const from = Game.movesFrom[move.move];
    const promotion: PieceType = move.move & 7;

    this.board[movedPiece.square] = null;
    this.board[from] = movedPiece;
    movedPiece.square = from;

    if (capturedPiece) {
      const opponentPieces = this.pieces[capturedPiece.color];

      opponentPieces[capturedPiece.index].index = this.pieceCounts[capturedPiece.color]++;
      opponentPieces[capturedPiece.index] = capturedPiece;

      this.material[capturedPiece.color] += Game.piecesWorth[capturedPiece.type];
      this.board[capturedPiece.square] = capturedPiece;

      if (capturedPiece.type === PieceType.BISHOP) {
        this.bishopsCount++;
      } else if (capturedPiece.type === PieceType.PAWN) {
        this.pawnCount++;
      }
    }

    if (promotion) {
      this.material[movedPiece.color] -= Game.piecesWorth[promotion] - Game.piecesWorth[PieceType.PAWN];
      movedPiece.type = PieceType.PAWN;
      this.pawnCount++;
    }

    if (castlingRook) {
      const oldSquare = Game.rookInitialSquares[castlingRook.square];

      this.board[castlingRook.square] = null;
      this.board[oldSquare] = castlingRook;
      castlingRook.square = oldSquare;
    }

    this.isCheck = move.wasCheck;
    this.isDoubleCheck = move.wasDoubleCheck;
    this.checkingPiece = move.prevCheckingPiece;

    this.positions.pop();

    this.positionKey = move.prevPositionKey;
    this.pawnKey = move.prevPawnKey;
    this.possibleEnPassant = move.prevPossibleEnPassant;
    this.possibleCastling = move.prevPossibleCastling;
    this.pliesWithoutCaptureOrPawnMove = move.prevPliesWithoutCaptureOrPawnMove;
    this.turn = prevTurn;
    this.isDraw = false;
  }

  setStartingData(fen: string) {
    const [piecesString, turnString, castlingString, enPassantString, pliesWithoutCaptureOrPawnMoveString] = fen.split(' ');
    const addPiece = (color: Color, pieceType: PieceType, x: number, y: number) => {
      const piece: Piece = {
        index: this.pieces[color].length,
        color,
        type: pieceType,
        square: Game.squares[y][x]
      };

      this.pieces[color].push(piece);
      this.board[piece.square] = piece;
      this.positionKey ^= this.pieceKeys[piece.color][piece.type][piece.square];
      this.pieceCounts[color]++;

      if (pieceType === PieceType.KING) {
        this.kings[color] = piece;
      } else {
        this.material[color] += Game.piecesWorth[pieceType];
      }

      if (pieceType === PieceType.BISHOP) {
        this.bishopsCount++;
      }

      if (pieceType === PieceType.PAWN) {
        this.pawnKey ^= this.pieceKeys[piece.color][piece.type][piece.square];
        this.pawnCount++;
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
      this.positionKey ^= this.turnKey;
    }

    if (castlingString !== '-') {
      for (const side of castlingString) {
        this.possibleCastling |= Game.fenCastling[side];
      }

      this.positionKey ^= this.castlingKeys[this.possibleCastling];
    }

    if (enPassantString !== '-') {
      this.possibleEnPassant = Game.literalToSquare(enPassantString);
      this.positionKey ^= this.enPassantKeys[this.possibleEnPassant];
    }

    this.pliesWithoutCaptureOrPawnMove = +pliesWithoutCaptureOrPawnMoveString;
    this.isCheck = this.isInCheck();
    this.isDoubleCheck = this.isInDoubleCheck();
    this.checkingPiece = this.getCheckingPiece();
    this.positions.push(this.positionKey);
  }
}
