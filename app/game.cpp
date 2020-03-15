#include <algorithm>
#include <iostream>
#include <random>
#include <string>
#include <vector>

#include "game.h"
#include "gameUtils.h"
#include "utils.h"

using namespace std;

Game::Game(const string &fen) {
  this->noPiece = new Piece({
    .index  = -1,
    .type   = NO_PIECE,
    .color  = NO_COLOR,
    .square = NO_SQUARE
  });

  this->fen = fen;
  this->turnKey = this->generateKey();

  for (auto &piece : this->board) {
    piece = this->noPiece;
  }

  for (auto &castlingKey : this->castlingKeys) {
    castlingKey = this->generateKey();
  }

  for (auto &enPassantKey : this->enPassantKeys) {
    enPassantKey = this->generateKey();
  }

  for (Color color = WHITE; color < NO_COLOR; ++color) {
    this->kings[color] = this->noPiece;
    this->material[color] = 0;
    this->pieceCounts[color] = 0;
    this->bitboards[color][ALL_PIECES] = 0ULL;

    for (PieceType pieceType = KING; pieceType <= PAWN; ++pieceType) {
      this->bitboards[color][pieceType] = 0ULL;

      for (Square square = SQ_A1; square < NO_SQUARE; ++square) {
        this->pieceKeys[color][pieceType][square] = this->generateKey();
      }
    }
  }

  this->setStartingData();
}

Game::~Game() {
  delete this->noPiece;

  for (Color color = WHITE; color < NO_COLOR; ++color) {
    for (int i = 0; i < this->pieceCounts[color]; i++) {
      delete this->pieces[color][i];
    }
  }
}

void Game::applyMoves(const string &moves) {
  if (moves.empty()) {
    return;
  }

  vector<string> split = utils::split(moves, " ");
  vector<string> newMoves;

  newMoves.insert(newMoves.end(), split.begin() + this->moveCount, split.end());

  for (auto &moveString : newMoves) {
    this->performMove(gameUtils::uciToMove(moveString));
  }
}

ZobristKey Game::generateKey() {
  std::default_random_engine generator(clock());
  std::uniform_int_distribution<int> distribution(0, 1);
  ZobristKey key = 0ULL;

  while (key == 0ULL || this->keys.find(key) != this->keys.end()) {
    key = 0ULL;

    for (int i = 0; i < 64; i++) {
      key = key << 1ULL | distribution(generator);
    }
  }

  this->keys.insert(key);

  return key;
}

Move* Game::getAllLegalMoves(Move* moves) {
  int pieceCount = this->pieceCounts[this->turn];

  for (int i = 0; i < pieceCount; i++) {
    Piece* piece = this->pieces[this->turn][i];
    bool isPawnPromotion = piece->type == PAWN && gameUtils::squareRanks[piece->square] == gameUtils::ranks[piece->color][RANK_7];
    List<Square, 32> squareList(this->getLegalMoves<false>(squareList.list, piece));

    for (auto &square : squareList) {
      Move move = gameUtils::move(piece->square, square);

      if (isPawnPromotion) {
        *moves++ = move | QUEEN;
        *moves++ = move | KNIGHT;
        *moves++ = move | ROOK;
        *moves++ = move | BISHOP;
      } else {
        *moves++ = move;
      }
    }
  }

  return moves;
}

Bitboard Game::getAttacks(Piece *piece) {
  if (piece->type == KNIGHT) {
    return gameUtils::knightAttacks2[piece->square];
  }

  if (piece->type == KING) {
    return gameUtils::kingAttacks2[piece->square];
  }

  if (piece->type == PAWN) {
    return gameUtils::pawnAttacks2[piece->color][piece->square];
  }

  return piece->type == QUEEN
    ? this->getSlidingAttacks(BISHOP, piece->square) | this->getSlidingAttacks(ROOK, piece->square)
    : this->getSlidingAttacks(piece->type, piece->square);
}

Bitboard Game::getAttacksTo(Square square, Color opponentColor) {
  return (
    (gameUtils::knightAttacks2[square] & this->bitboards[opponentColor][KNIGHT])
    | (gameUtils::kingAttacks2[square] & this->kings[opponentColor]->square)
    | (gameUtils::pawnAttacks2[~opponentColor][square] & this->bitboards[opponentColor][PAWN])
    | (this->getSlidingAttacks(BISHOP, square) & (this->bitboards[opponentColor][BISHOP] | this->bitboards[opponentColor][QUEEN]))
    | (this->getSlidingAttacks(ROOK, square) & (this->bitboards[opponentColor][ROOK] | this->bitboards[opponentColor][QUEEN]))
  );
}

template<bool stopAfter1>
Square* Game::getLegalMoves(Square* moves, Piece *piece) {
  bool isKing = piece->type == KING;

  if (!gameUtils::isSquareBitboard(this->checkers) && !isKing) {
    return moves;
  }

  Square kingSquare = this->kings[this->turn]->square;
  Color opponentColor = ~this->turn;
  bool isPawn = piece->type == PAWN;

  bool isPinned = false;
  bool isEnPassantPinned = false;
  PinDirection pinDirection = NO_PIN_DIRECTION;

  if (
    !isKing
    && gameUtils::areAligned[piece->square][kingSquare]
    && !this->isDirectionBlocked(piece->square, kingSquare)
  ) {
    isPinned = this->getSliderBehind(kingSquare, piece->square, opponentColor) != this->noPiece;

    if (isPinned) {
      pinDirection = gameUtils::areAlignedDiagonally[piece->square][kingSquare]
        ? PIN_DIAGONAL
        : gameUtils::squareRanks[piece->square] == gameUtils::squareRanks[kingSquare]
          ? PIN_HORIZONTAL
          : PIN_VERTICAL;
    }
  }

  if (
    !isPinned
    && isPawn
    && this->possibleEnPassant != NO_SQUARE
    && gameUtils::pawnAttacks2[piece->color][piece->square] & this->possibleEnPassant
  ) {
    Piece* capturedPawn = this->board[gameUtils::enPassantPieceSquares[this->possibleEnPassant]];

    this->board[capturedPawn->square] = this->noPiece;
    this->boardBitboard ^= capturedPawn->square;

    isEnPassantPinned = (
      this->getSliderBehind(kingSquare, piece->square, opponentColor) != this->noPiece
      && !this->isDirectionBlocked(piece->square, kingSquare)
    );

    this->board[capturedPawn->square] = capturedPawn;
    this->boardBitboard ^= capturedPawn->square;
  }

  if (isPinned && this->checkers) {
    return moves;
  }

  if (
    isPinned
    && (
      piece->type == KNIGHT
      || (
        pinDirection == PIN_DIAGONAL
        && piece->type == ROOK
      )
      || (
        pinDirection == PIN_HORIZONTAL
        && (piece->type == PAWN || piece->type == BISHOP)
      )
      || (
        pinDirection == PIN_VERTICAL
        && piece->type == BISHOP
      )
    )
  ) {
    return moves;
  }

  if (!this->checkers && !isKing && !isPinned && (!isPawn || !isEnPassantPinned)) {
    return this->getPseudoLegalMoves(moves, piece);
  }

  List<Square, 32> pseudoLegalMoves(this->getPseudoLegalMoves(pseudoLegalMoves.list, piece));
  Square* start = moves;
  Square prevSquare = piece->square;
  Piece* checkingPiece = this->checkers
    ? this->board[gameUtils::getBitboardSquare(this->checkers)]
    : this->noPiece;

  if (isKing) {
    this->boardBitboard ^= prevSquare;
  }

  for (auto &square : pseudoLegalMoves) {
    bool isEnPassantCapture = isPawn && square == this->possibleEnPassant;

    if (isEnPassantCapture && isEnPassantPinned) {
      continue;
    }

    if (this->checkers && !isKing) {
      Square capturedPieceSquare = isEnPassantCapture
        ? gameUtils::enPassantPieceSquares[this->possibleEnPassant]
        : square;

      if (
        // not capturing checking piece
        capturedPieceSquare != checkingPiece->square
        && (
          // and not blocking slider checker
          !gameUtils::isSlider(checkingPiece)
          || !gameUtils::isSquareBetween[kingSquare][square][checkingPiece->square]
        )
      ) {
        continue;
      }
    }

    if (!isKing) {
      if (!isPinned || gameUtils::areOnOneLine[kingSquare][square][prevSquare]) {
        *moves++ = square;

        if (stopAfter1) {
          return moves;
        }
      }

      continue;
    }

    if (!this->isSquareAttacked(square)) {
      *moves++ = square;
    }

    if (stopAfter1 && moves != start) {
      break;
    }
  }

  if (isKing) {
    this->boardBitboard ^= prevSquare;
  }

  return moves;
}

Square* Game::getPseudoLegalMoves(Square* moves, Piece *piece) {
  Piece* pieceInSquare;

  if (gameUtils::isSlider(piece)) {
    for (auto &directionAttacks : *gameUtils::slidingAttacks[piece->type][piece->square]) {
      for (auto &square : *directionAttacks) {
        pieceInSquare = this->board[square];

        if (pieceInSquare->color != piece->color) {
          *moves++ = square;
        }

        if (pieceInSquare != this->noPiece) {
          break;
        }
      }
    }
  } else if (piece->type == KNIGHT) {
    for (auto &square : *gameUtils::knightAttacks[piece->square]) {
      pieceInSquare = this->board[square];

      if (pieceInSquare->color != piece->color) {
        *moves++ = square;
      }
    }
  } else if (piece->type == KING) {
    for (auto &square : *gameUtils::kingAttacks[piece->square]) {
      pieceInSquare = this->board[square];

      if (pieceInSquare->color != piece->color) {
        *moves++ = square;
      }
    }

    if (
      piece->square == (piece->color == WHITE ? SQ_E1 : SQ_E8)
      && !this->checkers
      && this->possibleCastling & piece->color
    ) {
      List<Castling, 2> castlings;
      Castling kingSideCastling = ANY_OO & piece->color;
      Castling queenSideCastling = ANY_OOO & piece->color;

      if (this->possibleCastling & kingSideCastling) {
        *castlings.last++ = kingSideCastling;
      }

      if (this->possibleCastling & queenSideCastling) {
        *castlings.last++ = queenSideCastling;
      }

      for (auto &castling : castlings) {
        Square rookSquare;
        Square newRookSquare;
        Square newKingSquare;

        if (castling == WHITE_OO) {
          rookSquare = SQ_H1;
          newRookSquare = SQ_F1;
          newKingSquare = SQ_G1;
        } else if (castling == WHITE_OOO) {
          rookSquare = SQ_A1;
          newRookSquare = SQ_D1;
          newKingSquare = SQ_C1;
        } else if (castling == BLACK_OO) {
          rookSquare = SQ_H8;
          newRookSquare = SQ_F8;
          newKingSquare = SQ_G8;
        } else { // black OOO
          rookSquare = SQ_A8;
          newRookSquare = SQ_D8;
          newKingSquare = SQ_C8;
        }

        if (
          !this->isDirectionBlocked(piece->square, rookSquare)
          && !this->isSquareAttacked(newRookSquare)
        ) {
          *moves++ = newKingSquare;
        }
      }
    }
  } else { // pawn
    Direction direction = piece->color == WHITE ? NORTH : SOUTH;
    Square squareInFront = piece->square + direction;

    // advance move
    if (this->board[squareInFront] == this->noPiece) {
      *moves++ = squareInFront;

      // double advance move
      if (gameUtils::squareRanks[piece->square] == gameUtils::ranks[piece->color][RANK_2]) {
        squareInFront += direction;

        if (this->board[squareInFront] == this->noPiece) {
          *moves++ = squareInFront;
        }
      }
    }

    for (auto &square : *gameUtils::pawnAttacks[piece->color][piece->square]) {
      if (this->possibleEnPassant == square) {
        *moves++ = square;
      } else {
        pieceInSquare = this->board[square];

        if (pieceInSquare->color == ~piece->color) {
          *moves++ = square;
        }
      }
    }
  }

  return moves;
}

Piece* Game::getSliderBehind(Square square1, Square square2, Color color) {
  PieceType directionSlider = gameUtils::areAlignedDiagonally[square1][square2]
    ? BISHOP
    : ROOK;

  for (auto &behindSquare : *gameUtils::behindSquares[square1][square2]) {
    Piece* behindPiece = this->board[behindSquare];

    if (behindPiece != this->noPiece) {
      if (
        behindPiece->color == color
        && (
          behindPiece->type == QUEEN
          || behindPiece->type == directionSlider
        )
      ) {
        return behindPiece;
      }

      break;
    }
  }

  return this->noPiece;
}

Bitboard Game::getSlidingAttacks(PieceType pieceType, Square square) {
  MagicAttack* magicAttack = pieceType == BISHOP
    ? &gameUtils::bishopMagicAttacks[square]
    : &gameUtils::rookMagicAttacks[square];

  return magicAttack->attacks[(this->boardBitboard & magicAttack->mask) * magicAttack->magic >> magicAttack->shift];
}

bool Game::isControlledByOpponentPawn(Square square, Color opponentColor) {
  return this->bitboards[opponentColor][PAWN] & gameUtils::pawnAttacks2[~opponentColor][square];
}

bool Game::isDirectionBlocked(Square square1, Square square2) {
  return this->boardBitboard & gameUtils::middleSquares2[square1][square2];
}

bool Game::isDraw() {
  return (
    this->pliesFor50MoveRule >= 100
    || count(max(this->positions.begin(), this->positions.end() - (this->pliesFor50MoveRule + 1)), this->positions.end(), this->positionKey) >= 3
    || this->isInsufficientMaterial()
  );
}

bool Game::isEndgame() {
  return (
    this->pawnCount < 5
    || this->pieceCounts[WHITE] + this->pieceCounts[BLACK] - this->pawnCount < 9
  );
}

bool Game::isInsufficientMaterial() {
  Color minPiecesColor = this->pieceCounts[WHITE] > this->pieceCounts[BLACK]
    ? BLACK
    : WHITE;
  Color maxPiecesColor = ~minPiecesColor;
  int maxPiecesCount = this->pieceCounts[maxPiecesColor];

  if (maxPiecesCount == 1) {
    return true;
  }

  Piece** maxPieces = this->pieces[maxPiecesColor];
  int minPiecesCount = this->pieceCounts[minPiecesColor];

  if (minPiecesCount == 1 && maxPiecesCount == 2) {
    Piece* notKing = maxPieces[0]->type == KING ? maxPieces[0] : maxPieces[1];

    return notKing->type == KNIGHT || notKing->type == BISHOP;
  }

  if (this->bishopsCount != minPiecesCount + maxPiecesCount - 2) {
    return false;
  }

  int possibleBishopColor = gameUtils::squareColors[(maxPieces[0]->type == BISHOP ? maxPieces[0] : maxPieces[1])->square];

  for (int i = 0; i < maxPiecesCount; i++) {
    Piece* piece = maxPieces[i];

    if (piece->type == BISHOP && gameUtils::squareColors[piece->square] != possibleBishopColor) {
      return false;
    }
  }

  Piece** minPieces = this->pieces[minPiecesColor];

  for (int i = 0; i < minPiecesCount; i++) {
    Piece* piece = minPieces[i];

    if (piece->type == BISHOP && gameUtils::squareColors[piece->square] != possibleBishopColor) {
      return false;
    }
  }

  return true;
}

bool Game::isNoMoves() {
  Piece** pieces = this->pieces[this->turn];

  for (int i = 0; i < this->pieceCounts[this->turn]; i++) {
    List<Square, 32> squareList(this->getLegalMoves<true>(squareList.list, pieces[i]));

    if (!squareList.empty()) {
      return false;
    }
  }

  return true;
}

bool Game::isSquareAttacked(Square square) {
  Color opponentColor = ~this->turn;

  if (this->bitboards[opponentColor][PAWN] & gameUtils::pawnAttacks2[~opponentColor][square]) {
    return true;
  }

  if (gameUtils::kingAttacks2[square] & this->kings[opponentColor]->square) {
    return true;
  }

  if (gameUtils::knightAttacks2[square] & this->bitboards[opponentColor][KNIGHT]) {
    return true;
  }

  return (
    (this->getSlidingAttacks(BISHOP, square) & (this->bitboards[opponentColor][BISHOP] | this->bitboards[opponentColor][QUEEN]))
    || (this->getSlidingAttacks(ROOK, square) & (this->bitboards[opponentColor][ROOK] | this->bitboards[opponentColor][QUEEN]))
  );
}

MoveInfo Game::performMove(Move move) {
  Square from = gameUtils::getMoveFrom(move);
  Square to = gameUtils::getMoveTo(move);
  PieceType promotion = gameUtils::getMovePromotion(move);
  Piece* piece = this->board[from];
  PieceType pieceType = piece->type;
  Color pieceColor = piece->color;
  Color opponentColor = ~this->turn;
  Square prevPossibleEnPassant = this->possibleEnPassant;
  Castling prevPossibleCastling = this->possibleCastling;
  bool isEnPassantCapture = pieceType == PAWN && to == this->possibleEnPassant;
  Piece* capturedPiece = this->board[isEnPassantCapture ? gameUtils::enPassantPieceSquares[to] : to];
  Piece* castlingRook = this->noPiece;
  ZobristKey positionPieceKeyChange = this->pieceKeys[pieceColor][pieceType][from] ^ this->pieceKeys[pieceColor][pieceType][to];
  MoveInfo moveInfo = {
    .move = move,
    .movedPiece = piece,
    .capturedPiece = capturedPiece,
    .castlingRook = this->noPiece,
    .prevCheckers = this->checkers,
    .prevPositionKey = this->positionKey,
    .prevPawnKey = this->pawnKey,
    .prevPossibleEnPassant = prevPossibleEnPassant,
    .prevPossibleCastling = prevPossibleCastling,
    .prevPliesFor50MoveRule = this->pliesFor50MoveRule
  };

  this->positionKey ^= positionPieceKeyChange;

  if (pieceType == PAWN) {
    this->pawnKey ^= positionPieceKeyChange;
  }

  this->board[from] = this->noPiece;
  this->boardBitboard ^= from;
  this->bitboards[pieceColor][ALL_PIECES] ^= from;
  this->bitboards[pieceColor][pieceType] ^= from;

  this->board[to] = piece;
  this->boardBitboard |= to;
  this->bitboards[pieceColor][ALL_PIECES] |= to;
  this->bitboards[pieceColor][pieceType] |= to;

  piece->square = to;

  if (pieceType == KING) {
    this->possibleCastling &= ~(ANY_CASTLING & pieceColor);
  } else if (pieceType == ROOK) {
    if (from == SQ_A1) {
      this->possibleCastling &= ~WHITE_OOO;
    } else if (from == SQ_H1) {
      this->possibleCastling &= ~WHITE_OO;
    } else if (from == SQ_A8) {
      this->possibleCastling &= ~BLACK_OOO;
    } else if (from == SQ_H8) {
      this->possibleCastling &= ~BLACK_OO;
    }
  }

  if (pieceType == KING && abs(gameUtils::squareFiles[to] - gameUtils::squareFiles[from]) > 1) {
    Square rookSquare = NO_SQUARE;
    Square newRookSquare = NO_SQUARE;

    if (to == SQ_C1) {
      rookSquare = SQ_A1;
      newRookSquare = SQ_D1;
    } else if (to == SQ_G1) {
      rookSquare = SQ_H1;
      newRookSquare = SQ_F1;
    } else if (to == SQ_C8) {
      rookSquare = SQ_A8;
      newRookSquare = SQ_D8;
    } else if (to == SQ_G8) {
      rookSquare = SQ_H8;
      newRookSquare = SQ_F8;
    }

    castlingRook = moveInfo.castlingRook = this->board[rookSquare];

    this->positionKey ^= (
      this->pieceKeys[castlingRook->color][castlingRook->type][castlingRook->square]
      ^ this->pieceKeys[castlingRook->color][castlingRook->type][newRookSquare]
    );

    this->board[castlingRook->square] = this->noPiece;
    this->boardBitboard ^= castlingRook->square;
    this->bitboards[castlingRook->color][ALL_PIECES] ^= castlingRook->square;
    this->bitboards[castlingRook->color][ROOK] ^= castlingRook->square;

    this->board[newRookSquare] = castlingRook;
    this->boardBitboard ^= newRookSquare;
    this->bitboards[castlingRook->color][ALL_PIECES] ^= newRookSquare;
    this->bitboards[castlingRook->color][ROOK] ^= newRookSquare;

    castlingRook->square = newRookSquare;
  }

  if (capturedPiece != this->noPiece) {
    Piece** opponentPieces = this->pieces[opponentColor];

    (opponentPieces[capturedPiece->index] = opponentPieces[--this->pieceCounts[opponentColor]])->index = capturedPiece->index;

    this->material[opponentColor] -= gameUtils::piecesWorth[capturedPiece->type];
    this->positionKey ^= this->pieceKeys[capturedPiece->color][capturedPiece->type][capturedPiece->square];
    this->bitboards[opponentColor][ALL_PIECES] ^= capturedPiece->square;
    this->bitboards[opponentColor][capturedPiece->type] ^= capturedPiece->square;

    if (isEnPassantCapture) {
      this->boardBitboard ^= capturedPiece->square;
      this->board[capturedPiece->square] = this->noPiece;
    }

    if (capturedPiece->type == ROOK) {
      if (to == SQ_A1) {
        this->possibleCastling &= ~WHITE_OOO;
      } else if (to == SQ_H1) {
        this->possibleCastling &= ~WHITE_OO;
      } else if (to == SQ_A8) {
        this->possibleCastling &= ~BLACK_OOO;
      } else if (to == SQ_H8) {
        this->possibleCastling &= ~BLACK_OO;
      }
    } else if (capturedPiece->type == BISHOP) {
      this->bishopsCount--;
    } else if (capturedPiece->type == PAWN) {
      this->pawnKey ^= this->pieceKeys[capturedPiece->color][capturedPiece->type][capturedPiece->square];
      this->pawnCount--;
    }
  }

  if (capturedPiece != this->noPiece || pieceType == PAWN) {
    this->pliesFor50MoveRule = 0;
  } else {
    this->pliesFor50MoveRule++;
  }

  if (promotion != NO_PIECE) {
    piece->type = promotion;

    this->material[pieceColor] += gameUtils::piecesWorth[promotion] - gameUtils::piecesWorth[PAWN];
    this->bitboards[pieceColor][promotion] ^= to;
    this->bitboards[pieceColor][PAWN] ^= to;
    this->positionKey ^= this->pieceKeys[pieceColor][PAWN][to] ^ this->pieceKeys[pieceColor][promotion][to];
    this->pawnKey ^= this->pieceKeys[pieceColor][PAWN][to];
    this->pawnCount--;
  }

  if (pieceType == PAWN && abs(gameUtils::squareRanks[to] - gameUtils::squareRanks[from]) > 1) {
    File pawnFile = gameUtils::squareFiles[to];
    Piece* leftPiece = pawnFile == FILE_A ? this->noPiece : this->board[to - 1];
    Piece* rightPiece = pawnFile == FILE_H ? this->noPiece : this->board[to + 1];

    if ((
      leftPiece->type == PAWN
      && leftPiece->color == opponentColor
    ) || (
      rightPiece->type == PAWN
      && rightPiece->color == opponentColor
    )) {
      Square enPassantSquare = to + (pieceColor == WHITE ? SOUTH : NORTH);

      this->possibleEnPassant = enPassantSquare;
      this->positionKey ^= this->enPassantKeys[enPassantSquare];
    } else {
      this->possibleEnPassant = NO_SQUARE;
    }
  } else {
    this->possibleEnPassant = NO_SQUARE;
  }

  if (this->possibleCastling != prevPossibleCastling) {
    this->positionKey ^= this->castlingKeys[prevPossibleCastling] ^ this->castlingKeys[this->possibleCastling];
  }

  this->positionKey ^= this->turnKey;

  if (prevPossibleEnPassant != NO_SQUARE) {
    this->positionKey ^= this->enPassantKeys[prevPossibleEnPassant];
  }

  this->moveCount++;
  this->turn = opponentColor;
  this->checkers = this->getAttacksTo(this->kings[this->turn]->square, ~this->turn);

  this->positions.push(this->positionKey);

  return moveInfo;
}

void Game::printBoard() {
  for (Rank rank = RANK_8; rank >= RANK_1; --rank) {
    for (File file = FILE_A; file < NO_FILE; ++file) {
      Piece* piece = this->board[rank << 3 | file];

      if (piece == this->noPiece) {
        cout << ".";
      } else {
        cout << (char)(piece->color == WHITE ? gameUtils::pieces[piece->type] + ('A' - 'a') : gameUtils::pieces[piece->type]);
      }

      cout << " ";
    }

    cout << endl;
  }
}

void Game::revertMove(MoveInfo* move) {
  Piece* movedPiece = move->movedPiece;
  Piece* capturedPiece = move->capturedPiece;
  Piece* castlingRook = move->castlingRook;
  Square from = gameUtils::getMoveFrom(move->move);
  PieceType promotion = gameUtils::getMovePromotion(move->move);

  this->board[movedPiece->square] = this->noPiece;
  this->boardBitboard ^= movedPiece->square;
  this->bitboards[movedPiece->color][ALL_PIECES] ^= movedPiece->square;
  this->bitboards[movedPiece->color][movedPiece->type] ^= movedPiece->square;

  this->board[from] = movedPiece;
  this->boardBitboard ^= from;
  this->bitboards[movedPiece->color][ALL_PIECES] ^= from;
  this->bitboards[movedPiece->color][movedPiece->type] ^= from;

  movedPiece->square = from;

  if (capturedPiece != this->noPiece) {
    Piece** opponentPieces = this->pieces[capturedPiece->color];

    opponentPieces[capturedPiece->index]->index = this->pieceCounts[capturedPiece->color]++;
    opponentPieces[capturedPiece->index] = capturedPiece;

    this->material[capturedPiece->color] += gameUtils::piecesWorth[capturedPiece->type];
    this->board[capturedPiece->square] = capturedPiece;
    this->boardBitboard |= capturedPiece->square;
    this->bitboards[capturedPiece->color][ALL_PIECES] |= capturedPiece->square;
    this->bitboards[capturedPiece->color][capturedPiece->type] |= capturedPiece->square;

    if (capturedPiece->type == BISHOP) {
      this->bishopsCount++;
    } else if (capturedPiece->type == PAWN) {
      this->pawnCount++;
    }
  }

  if (promotion != NO_PIECE) {
    this->material[movedPiece->color] -= gameUtils::piecesWorth[promotion] - gameUtils::piecesWorth[PAWN];
    this->bitboards[movedPiece->color][promotion] ^= movedPiece->square;
    this->bitboards[movedPiece->color][PAWN] ^= movedPiece->square;
    movedPiece->type = PAWN;
    this->pawnCount++;
  }

  if (castlingRook != this->noPiece) {
    Square oldSquare = gameUtils::squares
      [gameUtils::ranks[castlingRook->color][RANK_1]]
      [gameUtils::squareFiles[castlingRook->square] == FILE_F ? FILE_H : FILE_A];

    this->board[castlingRook->square] = this->noPiece;
    this->boardBitboard ^= castlingRook->square;
    this->bitboards[castlingRook->color][ALL_PIECES] ^= castlingRook->square;
    this->bitboards[castlingRook->color][ROOK] ^= castlingRook->square;

    this->board[oldSquare] = castlingRook;
    this->boardBitboard ^= oldSquare;
    this->bitboards[castlingRook->color][ALL_PIECES] ^= oldSquare;
    this->bitboards[castlingRook->color][ROOK] ^= oldSquare;

    castlingRook->square = oldSquare;
  }

  this->positions.pop();

  this->checkers = move->prevCheckers;
  this->positionKey = move->prevPositionKey;
  this->pawnKey = move->prevPawnKey;
  this->possibleEnPassant = move->prevPossibleEnPassant;
  this->possibleCastling = move->prevPossibleCastling;
  this->pliesFor50MoveRule = move->prevPliesFor50MoveRule;
  this->turn = ~this->turn;
  this->moveCount--;
}

void Game::setStartingData() {
  vector<string> split = utils::split(this->fen, " ");
  string pieces = split[0];
  string turn = split[1];
  string possibleCastling = split[2];
  string possibleEnPassant = split[3];
  string pliesFor50MoveRule = split[4];

  auto addPiece = [this](Color color, PieceType pieceType, Rank rank, File file) {
    int index = this->pieceCounts[color]++;
    Square square = Square(rank << 3 | file);
    Piece* piece = new Piece({
      .index  = index,
      .type   = pieceType,
      .color  = color,
      .square = square
    });

    this->board[square] = piece;
    this->boardBitboard ^= square;
    this->bitboards[color][ALL_PIECES] ^= square;
    this->bitboards[color][pieceType] ^= square;
    this->pieces[color][index] = piece;
    this->positionKey ^= this->pieceKeys[color][pieceType][square];

    if (pieceType == KING) {
      this->kings[color] = piece;
    } else {
      this->material[color] += gameUtils::piecesWorth[pieceType];
    }

    if (pieceType == BISHOP) {
      this->bishopsCount++;
    }

    if (pieceType == PAWN) {
      this->pawnCount++;
      this->pawnKey ^= this->pieceKeys[color][pieceType][square];
    }
  };

  vector<string> ranks = utils::split(pieces, "/");

  reverse(ranks.begin(), ranks.end());

  for (Rank rank = RANK_1; rank < NO_RANK; ++rank) {
    File file = FILE_A;

    for (size_t i = 0; i < ranks[rank].length(); i++) {
      char p = ranks[rank][i];

      if (isdigit(p)) {
        file = file + (p - '0');
      } else {
        Color color = p < 'a' ? WHITE : BLACK;
        char lowerCased = p < 'a' ? p + ('a' - 'A') : p;
        PieceType pieceType = PieceType(gameUtils::pieces.find(lowerCased));

        addPiece(color, pieceType, rank, file);

        ++file;
      }
    }
  }

  this->turn = turn == "w" ? WHITE : BLACK;
  this->pliesFor50MoveRule = stoi(pliesFor50MoveRule);

  if (this->turn == WHITE) {
    this->positionKey ^= this->turnKey;
  }

  if (possibleEnPassant != "-") {
    this->possibleEnPassant = gameUtils::literalToSquare(possibleEnPassant);
    this->positionKey ^= this->enPassantKeys[this->possibleEnPassant];
  }

  if (possibleCastling != "-") {
    if (possibleCastling.find('K') != string::npos) this->possibleCastling |= WHITE_OO;
    if (possibleCastling.find('Q') != string::npos) this->possibleCastling |= WHITE_OOO;
    if (possibleCastling.find('k') != string::npos) this->possibleCastling |= BLACK_OO;
    if (possibleCastling.find('q') != string::npos) this->possibleCastling |= BLACK_OOO;
  }

  this->checkers = this->getAttacksTo(this->kings[this->turn]->square, ~this->turn);

  *this->positions.last++ = this->positionKey;
}
