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

  this->checkingPiece = this->noPiece;
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

  for (int color = WHITE; color < NO_COLOR; color++) {
    this->kings[color] = this->noPiece;
    this->material[color] = 0;
    this->pieceCounts[color] = 0;

    for (int pieceType = KING; pieceType < NO_PIECE; pieceType++) {
      for (int square = 0; square < NO_SQUARE; square++) {
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
  if (moves.length() == 0) {
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
  ZobristKey key = 0ULL;

  while (key == 0ULL || this->keys.find(key) != this->keys.end()) {
    key = 0ULL;

    for (int i = 0; i < 64; i++) {
      key = key << 1ULL | rand() % 2;
    }
  }

  this->keys.insert(key);

  return key;
}

Move* Game::getAllLegalMoves(Move* moves) {
  int pieceCount = this->pieceCounts[this->turn];

  for (int i = 0; i < pieceCount; i++) {
    Piece* piece = this->pieces[this->turn][i];
    bool isPawnPromotion = piece->type == PAWN && gameUtils::squareRanks[piece->square] == gameUtils::rank7(piece->color);
    List<Square, 32> squareList(this->getLegalMoves(squareList.list, piece, false));

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

Square* Game::getAttacks(Square* attacks, Piece* piece) {
  if (piece->type == KNIGHT) {
    for (auto &square : *gameUtils::knightAttacks[piece->square]) {
      *attacks++ = square;
    }
  } else if (piece->type == KING) {
    for (auto &square : *gameUtils::kingAttacks[piece->square]) {
      *attacks++ = square;
    }
  } else if (piece->type == PAWN) {
    for (auto &square : *gameUtils::pawnAttacks[piece->color][piece->square]) {
      *attacks++ = square;
    }
  } else {
    for (auto &directionAttacks : *gameUtils::slidingAttacks[piece->type][piece->square]) {
      for (auto &square : *directionAttacks) {
        *attacks++ = square;

        if (this->board[square] != this->noPiece) {
          break;
        }
      }
    }
  }

  return attacks;
}

Piece* Game::getCheckingPiece() {
  Piece** opponentPieces = this->pieces[~this->turn];
  int pieceCount = this->pieceCounts[~this->turn];

  for (int i = 0; i < pieceCount; i++) {
    Piece* piece = opponentPieces[i];
    List<Square, 32> attacks(this->getAttacks(attacks.list, piece));

    if (attacks.contains(this->kings[this->turn]->square)) {
      return piece;
    }
  }

  return this->noPiece;
}

Square* Game::getLegalMoves(Square* moves, Piece *piece, bool stopAfter1) {
  bool isKing = piece->type == KING;

  if (this->isDoubleCheck && !isKing) {
    return moves;
  }

  Square kingSquare = this->kings[this->turn]->square;
  Color opponentColor = ~this->turn;
  bool isPawn = piece->type == PAWN;

  bool isPinned = false;
  bool isEnPassantPinned = false;
  PinDirection pinDirection = NO_PIN_DIRECTION;
  Piece* pinningPiece = this->noPiece;

  if (
    !isKing
    && gameUtils::areAligned[piece->square][kingSquare]
    && !this->isDirectionBlocked(piece->square, kingSquare)
  ) {
    pinningPiece = this->getSliderBehind(kingSquare, piece->square, opponentColor);
    isPinned = pinningPiece != this->noPiece;

    if (isPinned) {
      pinDirection = gameUtils::areAlignedDiagonally[piece->square][kingSquare]
        ? PIN_DIAGONAL
        : gameUtils::squareRanks[piece->square] == gameUtils::squareRanks[kingSquare]
          ? PIN_HORIZONTAL
          : PIN_VERTICAL;
    }
  }

  vector<Square>* pawnAttacks = gameUtils::pawnAttacks[piece->color][piece->square];

  if (
    !isPinned
    && isPawn
    && this->possibleEnPassant != NO_SQUARE
    && find(pawnAttacks->begin(), pawnAttacks->end(), this->possibleEnPassant) != pawnAttacks->end()
  ) {
    Piece* capturedPawn = this->board[gameUtils::enPassantPieceSquares[this->possibleEnPassant]];

    this->board[capturedPawn->square] = this->noPiece;

    isEnPassantPinned = (
      this->getSliderBehind(kingSquare, piece->square, opponentColor) != this->noPiece
      && !this->isDirectionBlocked(piece->square, kingSquare)
    );

    this->board[capturedPawn->square] = capturedPawn;
  }

  if (isPinned && this->isCheck) {
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

  List<Square, 32> pseudoLegalMoves(this->getPseudoLegalMoves(pseudoLegalMoves.list, piece));

  if (!this->isCheck && !isKing && !isPinned && (!isPawn || !isEnPassantPinned)) {
    for (auto &square : pseudoLegalMoves) {
      *moves++ = square;
    }

    return moves;
  }

  Square* start = moves;
  Square prevSquare = piece->square;

  this->board[prevSquare] = this->noPiece;

  for (auto &square : pseudoLegalMoves) {
    bool isEnPassantCapture = isPawn && square == this->possibleEnPassant;

    if (isEnPassantCapture && isEnPassantPinned) {
      continue;
    }

    if (this->isCheck && !isKing) {
      Square capturedPieceSquare = isEnPassantCapture
        ? gameUtils::enPassantPieceSquares[this->possibleEnPassant]
        : square;

      if (
        // not capturing checking piece
        capturedPieceSquare != this->checkingPiece->square
        && (
          // and not blocking slider checker
          !gameUtils::isSlider(this->checkingPiece)
          || !gameUtils::isSquareBetween[kingSquare][square][this->checkingPiece->square]
        )
      ) {
        continue;
      }
    }

    if (!isKing) {
      if (!isPinned || gameUtils::areOnOneLine[kingSquare][square][pinningPiece->square]) {
        *moves++ = square;

        if (stopAfter1) {
          break;
        }
      }

      continue;
    }

    Piece* capturedPiece = this->board[square];

    if (capturedPiece != this->noPiece) {
      this->board[capturedPiece->square] = this->noPiece;
    }

    this->board[square] = piece;
    piece->square = square;

    if (!this->isInCheck()) {
      *moves++ = square;
    }

    this->board[square] = this->noPiece;

    if (capturedPiece != this->noPiece) {
      this->board[capturedPiece->square] = capturedPiece;
    }

    if (stopAfter1 && moves != start) {
      break;
    }
  }

  this->board[prevSquare] = piece;
  piece->square = prevSquare;

  return moves;
}

Square* Game::getPseudoLegalMoves(Square* moves, Piece *piece) {
  Piece* pieceInSquare;

  if (gameUtils::isSlider(piece)) {
    for (auto &directionAttacks : *gameUtils::slidingAttacks[piece->type][piece->square]) {
      for (auto &square : *directionAttacks) {
        pieceInSquare = this->board[square];

        if (pieceInSquare != this->noPiece) {
          if (pieceInSquare->color != piece->color) {
            *moves++ = square;
          }

          break;
        } else {
          *moves++ = square;
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
      && !this->isCheck
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
      if (gameUtils::squareRanks[piece->square] == gameUtils::rank2(piece->color)) {
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

bool Game::isControlledByOpponentPawn(Square square, Color opponentColor) {
  for (auto &attackedSquare : *gameUtils::pawnAttacks[~opponentColor][square]) {
    Piece* pieceInSquare = this->board[attackedSquare];

    if (
      pieceInSquare->color == opponentColor
      && pieceInSquare->type == PAWN
    ) {
      return true;
    }
  }

  return false;
}

bool Game::isDirectionBlocked(Square square1, Square square2) {
  for (auto &middleSquare : *gameUtils::middleSquares[square1][square2]) {
    if (this->board[middleSquare] != this->noPiece) {
      return true;
    }
  }

  return false;
}

bool Game::isDraw() {
  return (
    this->pliesFor50MoveRule >= 100
    || count(this->positions.end() - (this->pliesFor50MoveRule + 1), this->positions.end(), this->positionKey) >= 3
    || this->isInsufficientMaterial()
  );
}

bool Game::isEndgame() {
  return (
    this->pawnCount < 5
    || this->pieceCounts[WHITE] + this->pieceCounts[BLACK] - this->pawnCount < 9
  );
}

bool Game::isInCheck() {
  return this->isSquareAttacked(this->kings[this->turn]->square);
}

bool Game::isInDoubleCheck() {
  Piece** opponentPieces = this->pieces[~this->turn];
  int pieceCount = this->pieceCounts[~this->turn];
  int checkingPiecesCount = 0;

  for (int i = 0; i < pieceCount; i++) {
    List<Square, 32> attacks(this->getAttacks(attacks.list, opponentPieces[i]));

    if (attacks.contains(this->kings[this->turn]->square)) {
      checkingPiecesCount++;
    }
  }

  return checkingPiecesCount == 2;
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
    List<Square, 32> squareList(this->getLegalMoves(squareList.list, pieces[i], true));

    if (!squareList.empty()) {
      return false;
    }
  }

  return true;
}

bool Game::isSquareAttacked(Square square) {
  Color opponentColor = ~this->turn;
  Piece* pieceInSquare;

  if (this->isControlledByOpponentPawn(square, opponentColor)) {
    return true;
  }

  for (auto &attackedSquare : *gameUtils::knightAttacks[square]) {
    pieceInSquare = this->board[attackedSquare];

    if (
      pieceInSquare->color == opponentColor
      && pieceInSquare->type == KNIGHT
    ) {
      return true;
    }
  }

  for (auto &bishopDirections : *gameUtils::slidingAttacks[BISHOP][square]) {
    for (size_t i = 0; i < bishopDirections->size(); i++) {
      pieceInSquare = this->board[bishopDirections->at(i)];

      if (pieceInSquare != this->noPiece) {
        if (
          pieceInSquare->color == opponentColor
          && (
            pieceInSquare->type == BISHOP
            || pieceInSquare->type == QUEEN
            || (pieceInSquare->type == KING && i == 0)
          )
        ) {
          return true;
        }

        break;
      }
    }
  }

  for (auto &rookDirections : *gameUtils::slidingAttacks[ROOK][square]) {
    for (size_t i = 0; i < rookDirections->size(); i++) {
      pieceInSquare = this->board[rookDirections->at(i)];

      if (pieceInSquare != this->noPiece) {
        if (
          pieceInSquare->color == opponentColor
          && (
            pieceInSquare->type == ROOK
            || pieceInSquare->type == QUEEN
            || (pieceInSquare->type == KING && i == 0)
          )
        ) {
          return true;
        }

        break;
      }
    }
  }

  return false;
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
    .wasCheck = this->isCheck,
    .wasDoubleCheck = this->isDoubleCheck,
    .prevCheckingPiece = this->checkingPiece,
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
  this->board[to] = piece;

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
    this->board[newRookSquare] = castlingRook;

    castlingRook->square = newRookSquare;
  }

  if (capturedPiece != this->noPiece) {
    Piece** opponentPieces = this->pieces[opponentColor];

    (opponentPieces[capturedPiece->index] = opponentPieces[--this->pieceCounts[opponentColor]])->index = capturedPiece->index;

    this->material[opponentColor] -= gameUtils::piecesWorth[capturedPiece->type];
    this->positionKey ^= this->pieceKeys[capturedPiece->color][capturedPiece->type][capturedPiece->square];

    if (isEnPassantCapture) {
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

  this->positionKey ^= this->turnKey ^ this->castlingKeys[prevPossibleCastling] ^ this->castlingKeys[this->possibleCastling];

  if (prevPossibleEnPassant) {
    this->positionKey ^= this->enPassantKeys[prevPossibleEnPassant];
  }

  bool isCheck = false;
  bool isNormalCheck = false;
  bool isDiscoveredCheck = false;
  bool isEnPassantDiscoveredCheck = false;
  Piece* checkingPiece = this->noPiece;
  Square opponentKingSquare = this->kings[opponentColor]->square;
  Piece* possibleNormalCheckingPiece = castlingRook == this->noPiece ? piece : castlingRook;
  PieceType checkingPieceType = possibleNormalCheckingPiece->type;

  if (checkingPieceType == KNIGHT || checkingPieceType == PAWN) {
    vector<Square>* attacks = checkingPieceType == KNIGHT
      ? gameUtils::knightAttacks[possibleNormalCheckingPiece->square]
      : gameUtils::pawnAttacks[this->turn][possibleNormalCheckingPiece->square];

    if (find(attacks->begin(), attacks->end(), opponentKingSquare) != attacks->end()) {
      isCheck = isNormalCheck = true;
      checkingPiece = possibleNormalCheckingPiece;
    }
  } else if (
    checkingPieceType != KING
    && gameUtils::arePieceAligned[checkingPieceType][possibleNormalCheckingPiece->square][opponentKingSquare]
    && (
      !gameUtils::areOnOneLine[from][to][opponentKingSquare]
      || capturedPiece != this->noPiece
      || castlingRook != this->noPiece
      || promotion != NO_PIECE
    )
    && !this->isDirectionBlocked(possibleNormalCheckingPiece->square, opponentKingSquare)
  ) {
    isCheck = isNormalCheck = true;
    checkingPiece = possibleNormalCheckingPiece;
  }

  if (
    pieceType != QUEEN
    && (
      (gameUtils::areAlignedDiagonally[from][opponentKingSquare] && pieceType != BISHOP)
      || (gameUtils::areAlignedOrthogonally[from][opponentKingSquare] && pieceType != ROOK)
    )
    && !gameUtils::areOnOneLine[from][to][opponentKingSquare]
    && castlingRook == this->noPiece
  ) {
    Piece* sliderBehind = this->getSliderBehind(opponentKingSquare, from, pieceColor);

    if (sliderBehind != this->noPiece && !this->isDirectionBlocked(from, opponentKingSquare)) {
      isDiscoveredCheck = isCheck = true;
      checkingPiece = sliderBehind;
    }
  }

  if (!isNormalCheck && isEnPassantCapture && gameUtils::areAlignedDiagonally[opponentKingSquare][capturedPiece->square]) {
    Piece* sliderBehind = this->getSliderBehind(opponentKingSquare, capturedPiece->square, pieceColor);

    if (sliderBehind != this->noPiece && !this->isDirectionBlocked(capturedPiece->square, opponentKingSquare)) {
      isEnPassantDiscoveredCheck = isCheck = true;
      checkingPiece = sliderBehind;
    }
  }

  this->moveCount++;
  this->turn = opponentColor;
  this->isCheck = isCheck;
  this->isDoubleCheck = (isNormalCheck || isEnPassantDiscoveredCheck) && isDiscoveredCheck;
  this->checkingPiece = checkingPiece;

  this->positions.push(this->positionKey);

  return moveInfo;
}

void Game::printBoard() {
  for (int rank = 7; rank >= 0; rank--) {
    for (int file = 0; file < 8; file++) {
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
  this->board[from] = movedPiece;
  movedPiece->square = from;

  if (capturedPiece != this->noPiece) {
    Piece** opponentPieces = this->pieces[capturedPiece->color];

    opponentPieces[capturedPiece->index]->index = this->pieceCounts[capturedPiece->color]++;
    opponentPieces[capturedPiece->index] = capturedPiece;

    this->material[capturedPiece->color] += gameUtils::piecesWorth[capturedPiece->type];
    this->board[capturedPiece->square] = capturedPiece;

    if (capturedPiece->type == BISHOP) {
      this->bishopsCount++;
    } else if (capturedPiece->type == PAWN) {
      this->pawnCount++;
    }
  }

  if (promotion != NO_PIECE) {
    this->material[movedPiece->color] -= gameUtils::piecesWorth[promotion] - gameUtils::piecesWorth[PAWN];
    movedPiece->type = PAWN;
    this->pawnCount++;
  }

  if (castlingRook != this->noPiece) {
    Square oldSquare = gameUtils::squares
      [gameUtils::rank1(castlingRook->color)]
      [gameUtils::squareFiles[castlingRook->square] == FILE_F ? FILE_H : FILE_A];

    this->board[castlingRook->square] = this->noPiece;
    this->board[oldSquare] = castlingRook;
    castlingRook->square = oldSquare;
  }

  this->isCheck = move->wasCheck;
  this->isDoubleCheck = move->wasDoubleCheck;
  this->checkingPiece = move->prevCheckingPiece;

  this->positions.pop();

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

  this->isCheck = this->isInCheck();
  this->isDoubleCheck = this->isInDoubleCheck();
  this->checkingPiece = this->getCheckingPiece();

  *this->positions.last++ = this->positionKey;
}
