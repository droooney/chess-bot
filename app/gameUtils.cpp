#include <iostream>
#include <string>
#include <vector>

#include "gameUtils.h"

using namespace std;

PieceSquareTable gameUtils::allPieceSquareTables[2][6][2];
bool gameUtils::areAlignedDiagonally[64][64];
bool gameUtils::areAlignedOrthogonally[64][64];
bool gameUtils::areAligned[64][64];
bool gameUtils::areOnOneLine[64][64][64];
bool gameUtils::arePieceAligned[6][64][64];
vector<Square>* gameUtils::behindSquares[64][64];
int gameUtils::distances[64][64];
PieceSquareTable gameUtils::egWhiteKingPieceSquareTable = {
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50
};
Square gameUtils::enPassantPieceSquares[64];
bool gameUtils::isSquareBetween[64][64][64];
vector<Square>* gameUtils::kingAttacks[64];
Bitboard gameUtils::kingAttacks2[64];
vector<Square>* gameUtils::knightAttacks[64];
Bitboard gameUtils::knightAttacks2[64];
vector<Square>* gameUtils::middleSquares[64][64];
PieceSquareTable gameUtils::mgWhitePieceSquareTables[6] = {
  // king
  {
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20
  },

  // queen
  {
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  },

  // rook
  {
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
  },

  // bishop
  {
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  },

  // knight
  {
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  },

  // pawn
  {
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
  }
};
vector<Square>* gameUtils::pawnAttacks[2][64];
Bitboard gameUtils::pawnAttacks2[2][64];
Bitboard gameUtils::squareBitboards[64];
int gameUtils::squareColors[64];
File gameUtils::squareFiles[64];
Rank gameUtils::squareRanks[64];
vector<vector<Square>*>* gameUtils::slidingAttacks[6][64];
Square gameUtils::squares[8][8];

Square gameUtils::literalToSquare(const string &square) {
  return gameUtils::square(Rank(square[1] - '1'), File(square[0] - 'a'));
}

string gameUtils::moveToUci(Move move) {
  PieceType movePromotion = gameUtils::getMovePromotion(move);
  string from = squareToLiteral(gameUtils::getMoveFrom(move));
  string to = squareToLiteral(gameUtils::getMoveTo(move));
  string promotion = movePromotion == NO_PIECE
    ? ""
    : string(1, gameUtils::pieces[movePromotion]);

  return from + to + promotion;
}

string gameUtils::squareToLiteral(Square square) {
  return string(1, 'a' + gameUtils::fileOf(square)) + (char)('1' + gameUtils::rankOf(square));
}

vector<Square> gameUtils::traverseDirection(Square square, int incrementRank, int incrementFile, bool stopAfter1) {
  vector<Square> squares;

  File nextFile = gameUtils::fileOf(square) + incrementFile;
  Rank nextRank = gameUtils::rankOf(square) + incrementRank;

  if (nextFile < FILE_A || nextFile > FILE_H || nextRank < RANK_1 || nextRank > RANK_8) {
    return squares;
  }

  Square nextSquare = gameUtils::square(nextRank, nextFile);

  squares.push_back(nextSquare);

  if (stopAfter1) {
    return squares;
  }

  vector<Square> restSquares = gameUtils::traverseDirection(nextSquare, incrementRank, incrementFile, false);

  squares.insert(squares.end(), restSquares.begin(), restSquares.end());

  return squares;
}

Move gameUtils::uciToMove(const string &uci) {
  Move move = gameUtils::move(
    literalToSquare(uci.substr(0, 2)),
    literalToSquare(uci.substr(2, 2))
  );

  if (uci.length() == 5) {
    move |= PieceType(gameUtils::pieces.find(uci[4]));
  }

  return move;
}
