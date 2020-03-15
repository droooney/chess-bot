#include <iostream>

#include "gameUtils.h"
#include "init.h"
#include "utils.h"

using namespace std;

void init::init() {
  for (Square square = SQ_A1; square < NO_SQUARE; ++square) {
    File file = gameUtils::squareFiles[square] = gameUtils::fileOf(square);
    Rank rank = gameUtils::squareRanks[square] = gameUtils::rankOf(square);
    gameUtils::squares[rank][file] = square;
    gameUtils::enPassantPieceSquares[square] = gameUtils::square(rank == RANK_3 ? RANK_4 : rank == RANK_6 ? RANK_5 : rank,file);
    gameUtils::squareColors[square] = (rank + file) % 2;
    gameUtils::squareBitboards[square] = 1ULL << square;
  }

  for (Color color = WHITE; color < NO_COLOR; ++color) {
    for (File file = FILE_A; file < NO_FILE; ++file) {
      gameUtils::fileBitboards[file] = 0x0101010101010101ULL << file;
    }

    for (Rank rank = RANK_1; rank < NO_RANK; ++rank) {
      gameUtils::rankBitboards[color][rank] = 0xFFULL << (color == WHITE ? rank : 7 - rank) * 8;
    }

    for (PieceType pieceType = KING; pieceType <= PAWN; ++pieceType) {
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

      for (PieceType pieceType = KING; pieceType <= PAWN; ++pieceType) {
        gameUtils::arePieceAligned[pieceType][square1][square2] = (
          pieceType == QUEEN
            ? gameUtils::areAligned[square1][square2]
            : pieceType == ROOK
              ? gameUtils::areAlignedOrthogonally[square1][square2]
              : pieceType == BISHOP && gameUtils::areAlignedDiagonally[square1][square2]
        );
      }

      vector<Square>* middleSquares = gameUtils::middleSquares[square1][square2] = new vector<Square>;
      Bitboard* middleSquares2 = &gameUtils::middleSquares2[square1][square2];
      vector<Square>* behindSquares = gameUtils::behindSquares[square1][square2] = new vector<Square>;

      *middleSquares2 = 0ULL;

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
          *middleSquares2 |= 1ULL << square;
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
      Bitboard* kingAttacks2 = &gameUtils::kingAttacks2[square1];

      for (auto &increments : gameUtils::kingIncrements) {
        for (auto &square : gameUtils::traverseDirection(square1, increments[0], increments[1], true)) {
          kingAttacks->push_back(square);
          *kingAttacks2 |= 1ULL << square;
        }
      }
    }

    // fill knight attacks
    {
      vector<Square>* knightAttacks = gameUtils::knightAttacks[square1] = new vector<Square>;
      Bitboard* knightAttacks2 = &gameUtils::knightAttacks2[square1];

      for (auto &increments : gameUtils::knightIncrements) {
        for (auto &square : gameUtils::traverseDirection(square1, increments[0], increments[1], true)) {
          knightAttacks->push_back(square);
          *knightAttacks2 |= 1ULL << square;
        }
      }
    }

    // fill pawn attacks
    {
      for (Color color = WHITE; color < NO_COLOR; ++color) {
        vector<Square>* pawnAttacks = gameUtils::pawnAttacks[color][square1] = new vector<Square>;
        Bitboard* pawnAttacks2 = &gameUtils::pawnAttacks2[color][square1];
        Rank rank = gameUtils::rankOf(square1);

        if (gameUtils::rank8(color) != rank) {
          Rank attackedRank = rank + (color == WHITE ? 1 : -1);
          File file = gameUtils::fileOf(square1);

          if (file != FILE_A) {
            pawnAttacks->push_back(gameUtils::square(attackedRank, file - 1));
            *pawnAttacks2 |= 1ULL << gameUtils::square(attackedRank, file - 1);
          }

          if (file != FILE_H) {
            pawnAttacks->push_back(gameUtils::square(attackedRank, file + 1));
            *pawnAttacks2 |= 1ULL << gameUtils::square(attackedRank, file + 1);
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

    Bitboard edges = ((
      (gameUtils::rankBitboards[WHITE][RANK_1] | gameUtils::rankBitboards[WHITE][RANK_8])
      & ~gameUtils::rankBitboards[WHITE][gameUtils::rankOf(square1)]
    ) | (
      (gameUtils::fileBitboards[FILE_A] | gameUtils::fileBitboards[FILE_H])
      & ~gameUtils::fileBitboards[gameUtils::fileOf(square1)]
    ));

    for (auto &pieceType : { BISHOP, ROOK }) {
      Bitboard blockersTable[4096];
      Bitboard actualAttacks[4096];
      MagicAttack* magicAttack = pieceType == BISHOP
        ? &gameUtils::bishopMagicAttacks[square1]
        : &gameUtils::rookMagicAttacks[square1];
      Bitboard* attacks = magicAttack->attacks;
      Bitboard magic = magicAttack->magic = pieceType == BISHOP
        ? gameUtils::bishopMagics[square1]
        : gameUtils::rookMagics[square1];
      Bitboard mask = magicAttack->mask = gameUtils::getSlidingAttacks(square1, pieceType, 0ULL) & ~edges;
      int size = 1 << __pop_count(mask);
      unsigned int shift = magicAttack->shift = 64 - __pop_count(mask);
      Bitboard blockers = 0ULL;
      int index = 0;

      do {
        attacks[blockers * magic >> shift] = gameUtils::getSlidingAttacks(square1, pieceType, blockers);

        index++;
        blockers = (blockers - mask) & mask;
      } while (blockers);
    }
  }
}
