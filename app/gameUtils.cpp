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
Bitboard gameUtils::bishopMagics[64] = {
  0x40106000a1160020ULL, 0x20010250810120ULL, 0x2010010220280081ULL, 0x2806004050c040ULL, 0x2021018000000ULL, 0x2001112010000400ULL, 0x881010120218080ULL, 0x1030820110010500ULL,
  0x120222042400ULL, 0x2000020404040044ULL, 0x8000480094208000ULL, 0x3422a02000001ULL, 0xa220210100040ULL, 0x8004820202226000ULL, 0x18234854100800ULL, 0x100004042101040ULL,
  0x4001004082820ULL, 0x10000810010048ULL, 0x1014004208081300ULL, 0x2080818802044202ULL, 0x40880c00a00100ULL, 0x80400200522010ULL, 0x1000188180b04ULL, 0x80249202020204ULL,
  0x1004400004100410ULL, 0x13100a0022206ULL, 0x2148500001040080ULL, 0x4241080011004300ULL, 0x4020848004002000ULL, 0x10101380d1004100ULL, 0x8004422020284ULL, 0x1010a1041008080ULL,
  0x808080400082121ULL, 0x808080400082121ULL, 0x91128200100c00ULL, 0x202200802010104ULL, 0x8c0a020200440085ULL, 0x1a0008080b10040ULL, 0x889520080122800ULL, 0x100902022202010aULL,
  0x4081a0816002000ULL, 0x681208005000ULL, 0x8170840041008802ULL, 0xa00004200810805ULL, 0x830404408210100ULL, 0x2602208106006102ULL, 0x1048300680802628ULL, 0x2602208106006102ULL,
  0x602010120110040ULL, 0x941010801043000ULL, 0x40440a210428ULL, 0x8240020880021ULL, 0x400002012048200ULL, 0xac102001210220ULL, 0x220021002009900ULL, 0x84440c080a013080ULL,
  0x1008044200440ULL, 0x4c04410841000ULL, 0x2000500104011130ULL, 0x1a0c010011c20229ULL, 0x44800112202200ULL, 0x434804908100424ULL, 0x300404822c08200ULL, 0x48081010008a2a80ULL,
};
MagicAttack gameUtils::bishopMagicAttacks[64];
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
Bitboard gameUtils::fileBitboards[8];
bool gameUtils::isSquareBetween[64][64][64];
vector<Square>* gameUtils::kingAttacks[64];
Bitboard gameUtils::kingAttacks2[64];
vector<Square>* gameUtils::knightAttacks[64];
Bitboard gameUtils::knightAttacks2[64];
vector<Square>* gameUtils::middleSquares[64][64];
Bitboard gameUtils::middleSquares2[64][64];
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
Bitboard gameUtils::rankBitboards[2][8];
Bitboard gameUtils::rookMagics[64] = {
  0xa80004000801220ULL, 0x8040004010002008ULL, 0x2080200010008008ULL, 0x1100100008210004ULL, 0xc200209084020008ULL, 0x2100010004000208ULL, 0x400081000822421ULL, 0x200010422048844ULL,
  0x800800080400024ULL, 0x1402000401000ULL, 0x3000801000802001ULL, 0x4400800800100083ULL, 0x904802402480080ULL, 0x4040800400020080ULL, 0x18808042000100ULL, 0x4040800080004100ULL,
  0x40048001458024ULL, 0xa0004000205000ULL, 0x3100808010002000ULL, 0x4825010010000820ULL, 0x5004808008000401ULL, 0x2024818004000a00ULL, 0x5808002000100ULL, 0x2100060004806104ULL,
  0x80400880008421ULL, 0x4062220600410280ULL, 0x10a004a00108022ULL, 0x100080080080ULL, 0x21000500080010ULL, 0x44000202001008ULL, 0x100400080102ULL, 0xc020128200040545ULL,
  0x80002000400040ULL, 0x804000802004ULL, 0x120022004080ULL, 0x10a386103001001ULL, 0x9010080080800400ULL, 0x8440020080800400ULL, 0x4228824001001ULL, 0x490a000084ULL,
  0x80002000504000ULL, 0x200020005000c000ULL, 0x12088020420010ULL, 0x10010080080800ULL, 0x85001008010004ULL, 0x2000204008080ULL, 0x40413002040008ULL, 0x304081020004ULL,
  0x80204000800080ULL, 0x3008804000290100ULL, 0x1010100080200080ULL, 0x2008100208028080ULL, 0x5000850800910100ULL, 0x8402019004680200ULL, 0x120911028020400ULL, 0x8044010200ULL,
  0x20850200244012ULL, 0x20850200244012ULL, 0x102001040841ULL, 0x140900040a100021ULL, 0x200282410a102ULL, 0x200282410a102ULL, 0x200282410a102ULL, 0x4048240043802106ULL,
};
MagicAttack gameUtils::rookMagicAttacks[64];
Bitboard gameUtils::squareBitboards[64];
int gameUtils::squareColors[64];
File gameUtils::squareFiles[64];
Rank gameUtils::squareRanks[64];
vector<vector<Square>*>* gameUtils::slidingAttacks[6][64];
Square gameUtils::squares[8][8];

Bitboard gameUtils::getSlidingAttacks(Square square, PieceType pieceType, Bitboard blockers) {
  Bitboard attacks = 0ULL;

  for (auto &directionAttacks : *gameUtils::slidingAttacks[pieceType][square]) {
    for (auto &square : *directionAttacks) {
      attacks |= square;

      if (blockers & square) {
        break;
      }
    }
  }

  return attacks;
}

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

Square gameUtils::popBitboardSquare(Bitboard* bitboard) {
  if (!*bitboard) {
    return NO_SQUARE;
  }

  Square square = Square(ffsll(*bitboard) - 1);

  *bitboard ^= square;

  return square;
}

void gameUtils::printBitboard(Bitboard bitboard) {
  for (Rank rank = RANK_8; rank >= RANK_1; --rank) {
    for (File file = FILE_A; file < NO_FILE; ++file) {
      cout << (bitboard & gameUtils::square(rank, file) ? "X" : ".") << " ";
    }

    cout << endl;
  }
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
