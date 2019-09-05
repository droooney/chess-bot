import * as _ from 'lodash';

import Utils, {
  Board,
  CastlingSide,
  Color,
  Move,
  Piece,
  PieceType,
  PinnedDirection,
  Result
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
  result: Result | null = null;
  isCheck: boolean = false;
  isDoubleCheck: boolean = false;
  checkingPiece: Piece | null = null;
  board: Board = Game.allSquares.map(() => null);
  kings: { [color in Color]: Piece; } = [null!, null!];
  keys: { [key in string]: true; } = {};
  pieces: { [color in Color]: Piece[]; } = [[], []];
  pieceCounts: { [color in Color]: number; } = [0, 0];
  bishopsCount: number = 0;
  material: { [color in Color]: number; } = [0, 0];
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
  notOwnPiece: { [color in Color]: (square: number) => boolean; } = [
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
      const legalMoves = this.getLegalMoves(piece);

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        const square = legalMoves[i];
        const move = piece.square << 9 | square << 3;

        if (piece.type === PieceType.PAWN && square in Game.promotionSquares[this.turn]) {
          moves.push(move | PieceType.QUEEN);
          moves.push(move | PieceType.KNIGHT);
          moves.push(move | PieceType.ROOK);
          moves.push(move | PieceType.BISHOP);
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

  getLegalMoves(piece: Piece): number[] {
    const isKing = piece.type === PieceType.KING;

    if (this.isDoubleCheck && !isKing) {
      return [];
    }

    const kingSquare = this.kings[this.turn].square;
    const opponentColor = Game.oppositeColor[piece.color];

    let isPinned = false;
    let pinnedDirection;
    let pinnedDirectionSquaresMap = {};

    if (Game.isAlignedOrthogonally[piece.square][kingSquare] || Game.isAlignedDiagonally[piece.square][kingSquare]) {
      const behindSquares = Game.behindSquares[piece.square][kingSquare];
      const sliders = Game.isAlignedDiagonally[piece.square][kingSquare]
        ? Game.diagonalSliders
        : Game.orthogonalSliders;
      let sliderBehind;

      for (let i = 0; i < behindSquares.length; i++) {
        const behindPiece = this.board[behindSquares[i]];

        if (behindPiece) {
          if (behindPiece.color === opponentColor && behindPiece.type in sliders) {
            sliderBehind = behindPiece;
          }

          break;
        }
      }

      if (sliderBehind) {
        isPinned = true;

        const middleSquares = Game.middleSquares[piece.square][kingSquare];

        for (let i = 0; i < middleSquares.length; i++) {
          if (this.board[middleSquares[i]]) {
            isPinned = false;

            break;
          }
        }

        if (isPinned) {
          pinnedDirection = Game.isAlignedDiagonally[piece.square][kingSquare]
            ? PinnedDirection.DIAGONAL
            : Game.squareRanks[piece.square] === Game.squareRanks[kingSquare]
              ? PinnedDirection.HORIZONTAL
              : PinnedDirection.VERTICAL;
          pinnedDirectionSquaresMap = Game.behindAndMiddleSquaresMap[piece.square][kingSquare];
        }
      }
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
    const isPawn = piece.type === PieceType.PAWN;
    const isNoCheckAndNotPinned = !this.isCheck && !isKing && !isPinned;

    if (isNoCheckAndNotPinned && (!isPawn || !this.possibleEnPassant)) {
      return possibleMoves;
    }

    const legalMoves: number[] = [];
    const prevSquare = piece.square;
    const enPassantCapturedPawn = this.possibleEnPassant && this.board[Game.pawnEnPassantPieceSquares[this.possibleEnPassant]];
    const isAlmostLegalPawnMove = isNoCheckAndNotPinned && isPawn;

    this.board[prevSquare] = null;

    for (let i = 0, l = possibleMoves.length; i < l; i++) {
      const square = possibleMoves[i];

      if (isAlmostLegalPawnMove && square !== this.possibleEnPassant) {
        legalMoves.push(square);

        continue;
      }

      if (this.isCheck && !isKing && (!isPawn || square !== this.possibleEnPassant)) {
        if (
          // not capturing checking piece
          square !== this.checkingPiece!.square
          && (
            // and not blocking slider checker
            !(this.checkingPiece!.type in Game.sliders)
            || !(square in Game.middleSquaresMap[kingSquare][this.checkingPiece!.square])
          )
        ) {
          continue;
        }
      }

      if (!isKing && (!isPawn || square !== this.possibleEnPassant)) {
        if (!isPinned || square in pinnedDirectionSquaresMap) {
          legalMoves.push(square);
        }

        continue;
      }

      const capturedPiece = isPawn && square === this.possibleEnPassant
        ? enPassantCapturedPawn
        : this.board[square];

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
      if (this.getLegalMoves(pieces[i]).length) {
        return false;
      }
    }

    return true;
  }

  isSquareAttacked(square: number): boolean {
    const opponentColor = Game.oppositeColor[this.turn];
    const pieces = this.pieces[opponentColor];
    const pieceCount = this.pieceCounts[opponentColor];

    pieces: for (let i = 0; i < pieceCount; i++) {
      const piece = pieces[i];

      if (piece.type === PieceType.KNIGHT || piece.type === PieceType.PAWN) {
        if (
          square in (
            piece.type === PieceType.KNIGHT
              ? Game.knightAttacksMap[piece.square]
              : Game.pawnAttacksMap[piece.color][piece.square]
          )
        ) {
          return true;
        }
      } else if (piece.type !== PieceType.KING) {
        if (piece.type === PieceType.ROOK && !Game.isAlignedOrthogonally[square][piece.square]) {
          continue;
        }

        if (piece.type === PieceType.BISHOP && !Game.isAlignedDiagonally[square][piece.square]) {
          continue;
        }

        if (
          piece.type === PieceType.QUEEN
          && !Game.isAlignedOrthogonally[square][piece.square]
          && !Game.isAlignedDiagonally[square][piece.square]
        ) {
          continue;
        }

        const middleSquares = Game.middleSquares[piece.square][square];

        for (let i = 0, l = middleSquares.length; i < l; i++) {
          if (this.board[middleSquares[i]]) {
            continue pieces;
          }
        }

        return true;
      }
    }

    return false;
  }

  performMove(move: number): Move {
    // this.moves.push(move);

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
    const wasDoubleCheck = this.isDoubleCheck;
    const prevCheckingPiece = this.checkingPiece;
    const prevPosition = this.position;
    const prevPossibleEnPassant = this.possibleEnPassant;
    const prevPossibleCastling = this.possibleCastling;
    const prevPliesWithoutCaptureOrPawnMove = this.pliesWithoutCaptureOrPawnMove;
    const isEnPassantCapture = pieceType === PieceType.PAWN && to === this.possibleEnPassant;
    const capturedPiece = isEnPassantCapture
      ? this.board[Game.pawnEnPassantPieceSquares[to]]
      : this.board[to];
    let checkingPiece: Piece | null = null;
    let castlingRook: Piece | null = null;

    this.position ^= this.pieceKeys[pieceColor][pieceType][from] ^ this.pieceKeys[pieceColor][pieceType][to];

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

      this.position ^= this.pieceKeys[rook.color][rook.type][rook.square] ^ this.pieceKeys[rook.color][rook.type][newRookSquare];

      this.board[rook.square] = null;
      this.board[newRookSquare] = rook;

      rook.square = newRookSquare;

      castlingRook = rook;
    }

    if (capturedPiece) {
      const opponentPieces = this.pieces[opponentColor];

      (opponentPieces[capturedPiece.index] = opponentPieces[--this.pieceCounts[opponentColor]]).index = capturedPiece.index;

      this.material[capturedPiece.color] -= Game.piecesWorth[capturedPiece.type];
      this.position ^= this.pieceKeys[capturedPiece.color][capturedPiece.type][capturedPiece.square];

      if (isEnPassantCapture) {
        this.board[capturedPiece.square] = null;
      }

      if (capturedPiece.type === PieceType.ROOK && capturedPiece.square in Game.rookCastlingPermissions) {
        this.possibleCastling &= ~Game.rookCastlingPermissions[capturedPiece.square];
      }

      if (capturedPiece.type === PieceType.BISHOP) {
        this.bishopsCount--;
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
      this.position ^= this.pieceKeys[pieceColor][PieceType.PAWN][to] ^ this.pieceKeys[pieceColor][promotion][to];
    }

    if (pieceType === PieceType.PAWN && Game.pawnDoubleAdvanceMoves[pieceColor][from] === to) {
      const leftPiece = this.board[Game.pawnEnPassantOpponentPawnSquares[to][0]];
      const rightPiece = this.board[Game.pawnEnPassantOpponentPawnSquares[to][1]];

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

    let isCheck = false;
    let isNormalCheck = false;
    let isDiscoveredCheck = false;
    const opponentKingSquare = this.kings[opponentColor].square;
    const newPieceType = piece.type;

    if (newPieceType === PieceType.KNIGHT || newPieceType === PieceType.PAWN) {
      isCheck = isNormalCheck = opponentKingSquare in (
        newPieceType === PieceType.KNIGHT
          ? Game.knightAttacksMap[to]
          : Game.pawnAttacksMap[pieceColor][to]
      );

      if (isCheck) {
        checkingPiece = piece;
      }
    } else if (newPieceType !== PieceType.KING) {
      if (
        ((newPieceType === PieceType.BISHOP || newPieceType === PieceType.QUEEN) && Game.isAlignedDiagonally[to][opponentKingSquare])
        || ((newPieceType === PieceType.ROOK || newPieceType === PieceType.QUEEN) && Game.isAlignedOrthogonally[to][opponentKingSquare])
      ) {
        isCheck = isNormalCheck = true;

        const middleSquares = Game.middleSquares[to][opponentKingSquare];

        for (let i = 0; i < middleSquares.length; i++) {
          if (this.board[middleSquares[i]]) {
            isCheck = isNormalCheck = false;

            break;
          }
        }

        if (isCheck) {
          checkingPiece = piece;
        }
      }
    }

    if (Game.isAlignedDiagonally[from][opponentKingSquare] || Game.isAlignedOrthogonally[from][opponentKingSquare]) {
      const behindSquares = Game.behindSquares[from][opponentKingSquare];
      const sliders = Game.isAlignedDiagonally[from][opponentKingSquare]
        ? Game.diagonalSliders
        : Game.orthogonalSliders;
      let sliderBehind;

      for (let i = 0; i < behindSquares.length; i++) {
        const behindPiece = this.board[behindSquares[i]];

        if (behindPiece) {
          if (behindPiece.color === pieceColor && behindPiece.type in sliders) {
            sliderBehind = behindPiece;
          }

          break;
        }
      }

      if (sliderBehind) {
        isDiscoveredCheck = true;

        const middleSquares = Game.middleSquares[from][opponentKingSquare];

        for (let i = 0; i < middleSquares.length; i++) {
          if (this.board[middleSquares[i]]) {
            isDiscoveredCheck = false;

            break;
          }
        }

        if (isDiscoveredCheck) {
          isCheck = true;
          checkingPiece = sliderBehind;
        }
      }
    }

    this.turn = opponentColor;
    this.isCheck = isCheck;
    this.isDoubleCheck = isNormalCheck && isDiscoveredCheck;
    this.checkingPiece = checkingPiece;
    this.positions.set(this.position, this.positions.get(this.position)! + 1 || 1);

    if (
      this.pliesWithoutCaptureOrPawnMove >= 100
      || this.positions.get(this.position)! >= 3
      || this.isInsufficientMaterial()
    ) {
      this.result = Result.DRAW;
    }

    return {
      move,
      changedPiece: piece,
      changedPieceOldSquare: from,
      capturedPiece,
      promotedPawn: promotion ? piece : null,
      castlingRook,
      wasCheck,
      wasDoubleCheck,
      prevCheckingPiece,
      prevPosition,
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
      changedPiece,
      changedPieceOldSquare,
      capturedPiece,
      promotedPawn,
      castlingRook,
      wasCheck,
      wasDoubleCheck,
      prevCheckingPiece,
      prevPosition,
      prevPossibleEnPassant,
      prevPossibleCastling,
      prevPliesWithoutCaptureOrPawnMove
    } = move;

    this.board[changedPiece.square] = null;
    this.board[changedPieceOldSquare] = changedPiece;
    changedPiece.square = changedPieceOldSquare;

    if (capturedPiece) {
      const opponentPieces = this.pieces[capturedPiece.color];

      opponentPieces[capturedPiece.index].index = this.pieceCounts[capturedPiece.color]++;
      opponentPieces[capturedPiece.index] = capturedPiece;

      this.material[capturedPiece.color] += Game.piecesWorth[capturedPiece.type];
      this.board[capturedPiece.square] = capturedPiece;

      if (capturedPiece.type === PieceType.BISHOP) {
        this.bishopsCount++;
      }
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
    this.isDoubleCheck = wasDoubleCheck;
    this.checkingPiece = prevCheckingPiece;

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
      this.position ^= this.pieceKeys[piece.color][piece.type][piece.square];
      this.pieceCounts[color]++;

      if (pieceType === PieceType.KING) {
        this.kings[color] = piece;
      } else {
        this.material[color] += Game.piecesWorth[pieceType];
      }

      if (pieceType === PieceType.BISHOP) {
        this.bishopsCount++;
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
    this.isCheck = this.isInCheck();
    this.isDoubleCheck = this.isInDoubleCheck();
    this.checkingPiece = this.getCheckingPiece();
    this.positions.set(this.position, 1);
  }
}
