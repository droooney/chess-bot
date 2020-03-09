#include <iostream>

#include "gameUtils.h"
#include "init.h"
#include "utils.h"

using namespace std;

void init::init() {
  for (Color color = WHITE; color < NO_COLOR; ++color) {
    for (int pieceType = KING; pieceType < NO_PIECE; pieceType++) {
      for (int isEndgame = 0; isEndgame < 2; isEndgame++) {
        for (Square square = SQ_A1; square < NO_SQUARE; ++square) {
          int assignedSquare = color == WHITE
            ? (7 - gameUtils::rankOf(square)) << 3 | gameUtils::fileOf(square)
            : square;

          gameUtils::allPieceSquareTables[color][pieceType][isEndgame][assignedSquare] = pieceType == KING && isEndgame
            ? gameUtils::egWhiteKingPieceSquareTable[square]
            : gameUtils::mgWhitePieceSquareTables[pieceType][square];
        }
      }
    }
  }

  for (Square square1 = SQ_A1; square1 < NO_SQUARE; ++square1) {
    for (Square square2 = SQ_A1; square2 < NO_SQUARE; ++square2) {
      for (Square square3 = SQ_A1; square3 < NO_SQUARE; ++square3) {
        gameUtils::areOnOneLine[square1][square2][square3] = (
          (gameUtils::rankOf(square1) - gameUtils::rankOf(square2)) * (gameUtils::fileOf(square1) - gameUtils::fileOf(square3))
          == (gameUtils::rankOf(square1) - gameUtils::rankOf(square3)) * (gameUtils::fileOf(square1) - gameUtils::fileOf(square2))
        );
        gameUtils::isSquareBetween[square1][square2][square3] = (
          gameUtils::areOnOneLine[square1][square2][square3]
          && (square1 < square3 ? square1 < square2 && square2 < square3 : square1 > square2 && square2 > square3)
        );
      }

      gameUtils::areAlignedDiagonally[square1][square2] = (
        abs(gameUtils::rankOf(square1) - gameUtils::rankOf(square2))
        == abs(gameUtils::fileOf(square1) - gameUtils::fileOf(square2))
      );
      gameUtils::areAlignedOrthogonally[square1][square2] = (
        gameUtils::rankOf(square1) == gameUtils::rankOf(square2)
        || gameUtils::fileOf(square1) == gameUtils::fileOf(square2)
      );
      gameUtils::areAligned[square1][square2] = (
        gameUtils::areAlignedDiagonally[square1][square2] || gameUtils::areAlignedOrthogonally[square1][square2]
      );
      gameUtils::distances[square1][square2] = (
        abs(gameUtils::rankOf(square1) - gameUtils::rankOf(square2))
        + abs(gameUtils::fileOf(square1) - gameUtils::fileOf(square2))
      );

      for (PieceType pieceType = KING; pieceType < NO_PIECE; ++pieceType) {
        gameUtils::arePieceAligned[pieceType][square1][square2] = (
          pieceType == QUEEN
            ? gameUtils::areAligned[square1][square2]
            : pieceType == ROOK
              ? gameUtils::areAlignedOrthogonally[square1][square2]
              : pieceType == BISHOP && gameUtils::areAlignedDiagonally[square1][square2]
        );
      }

      vector<Square>* middleSquares = gameUtils::middleSquares[square1][square2] = new vector<Square>;
      vector<Square>* behindSquares = gameUtils::behindSquares[square1][square2] = new vector<Square>;

      // fill middle squares
      if (square1 != square2 && gameUtils::areAligned[square1][square2]) {
        int incrementFile = utils::sign(gameUtils::fileOf(square2) - gameUtils::fileOf(square1));
        int incrementRank = utils::sign(gameUtils::rankOf(square2) - gameUtils::rankOf(square1));
        Square square = square1;

        while (true) {
          square = gameUtils::square(
            gameUtils::rankOf(square) + incrementRank,
            gameUtils::fileOf(square) + incrementFile
          );

          if (square == square2) {
            break;
          }

          middleSquares->push_back(square);
        }
      }

      // fill behind squares
      if (square1 != square2 && gameUtils::areAligned[square1][square2]) {
        int incrementFile = utils::sign(gameUtils::fileOf(square2) - gameUtils::fileOf(square1));
        int incrementRank = utils::sign(gameUtils::rankOf(square2) - gameUtils::rankOf(square1));

        vector<Square> behindSquaresArray = gameUtils::traverseDirection(square2, incrementRank, incrementFile, false);

        behindSquares->insert(behindSquares->end(), behindSquaresArray.begin(), behindSquaresArray.end());
      }
    }

    // fill king attacks
    {
      vector<Square>* kingAttacks = gameUtils::kingAttacks[square1] = new vector<Square>;

      for (auto &increments : gameUtils::kingIncrements) {
        vector<Square> directionAttacks = gameUtils::traverseDirection(square1, increments[0], increments[1], true);

        kingAttacks->insert(kingAttacks->end(), directionAttacks.begin(), directionAttacks.end());
      }
    }

    // fill knight attacks
    {
      vector<Square>* knightAttacks = gameUtils::knightAttacks[square1] = new vector<Square>;

      for (auto &increments : gameUtils::knightIncrements) {
        vector<Square> directionAttacks = gameUtils::traverseDirection(square1, increments[0], increments[1], true);

        knightAttacks->insert(knightAttacks->end(), directionAttacks.begin(), directionAttacks.end());
      }
    }

    // fill pawn attacks
    {
      for (Color color = WHITE; color < NO_COLOR; ++color) {
        vector<Square>* pawnAttacks = gameUtils::pawnAttacks[color][square1] = new vector<Square>;
        Rank rank = gameUtils::rankOf(square1);

        if (gameUtils::rank8(color) != rank) {
          Rank attackedRank = rank + (color == WHITE ? 1 : -1);
          File file = gameUtils::fileOf(square1);

          if (file != FILE_A) {
            pawnAttacks->push_back(gameUtils::square(attackedRank, file - 1));
          }

          if (file != FILE_H) {
            pawnAttacks->push_back(gameUtils::square(attackedRank, file + 1));
          }
        }
      }
    }

    // fill sliding attacks
    {
      vector<vector<Square>*>* bishopAttacks = gameUtils::slidingAttacks[BISHOP][square1] = new vector<vector<Square>*>;
      vector<vector<Square>*>* rookAttacks = gameUtils::slidingAttacks[ROOK][square1] = new vector<vector<Square>*>;
      vector<vector<Square>*>* queenAttacks = gameUtils::slidingAttacks[QUEEN][square1] = new vector<vector<Square>*>;

      for (auto &increments : gameUtils::diagonalIncrements) {
        vector<Square> directionAttacksArray = gameUtils::traverseDirection(square1, increments[0], increments[1], false);

        if (!directionAttacksArray.empty()) {
          auto directionAttacks = new vector<Square>;

          directionAttacks->insert(directionAttacks->end(), directionAttacksArray.begin(), directionAttacksArray.end());

          bishopAttacks->push_back(directionAttacks);
          queenAttacks->push_back(directionAttacks);
        }
      }

      for (auto &increments : gameUtils::orthogonalIncrements) {
        vector<Square> directionAttacksArray = gameUtils::traverseDirection(square1, increments[0], increments[1], false);

        if (!directionAttacksArray.empty()) {
          auto directionAttacks = new vector<Square>;

          directionAttacks->insert(directionAttacks->end(), directionAttacksArray.begin(), directionAttacksArray.end());

          rookAttacks->push_back(directionAttacks);
          queenAttacks->push_back(directionAttacks);
        }
      }
    }

    File file = gameUtils::squareFiles[square1] = gameUtils::fileOf(square1);
    Rank rank = gameUtils::squareRanks[square1] = gameUtils::rankOf(square1);
    gameUtils::squares[rank][file] = square1;
    gameUtils::enPassantPieceSquares[square1] = gameUtils::square(rank == RANK_3 ? RANK_4 : rank == RANK_6 ? RANK_5 : rank,file);
    gameUtils::squareColors[square1] = (rank + file) % 2;
  }
}
