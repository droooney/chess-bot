#include <string>
#include <vector>

#include "utils.h"

#ifndef GAME_UTILS_INCLUDED
#define GAME_UTILS_INCLUDED

using namespace std;

enum Color {
  WHITE,
  BLACK,

  NO_COLOR
};

constexpr Color operator~(Color c) {
  return Color(c ^ 1);
}

constexpr Color& operator++(Color &color) {
  return color = Color(color + 1);
}

constexpr Color& operator--(Color &color) {
  return color = Color(color - 1);
}

enum Castling {
  NO_CASTLING,

  WHITE_OO,
  WHITE_OOO      = WHITE_OO << 1,
  BLACK_OO       = WHITE_OO << 2,
  BLACK_OOO      = WHITE_OO << 3,

  ANY_OO         = WHITE_OO  | BLACK_OO,
  ANY_OOO        = WHITE_OOO | BLACK_OOO,
  WHITE_CASTLING = WHITE_OO  | WHITE_OOO,
  BLACK_CASTLING = BLACK_OO  | BLACK_OOO,

  ANY_CASTLING   = WHITE_CASTLING | BLACK_CASTLING
};

constexpr Castling operator~(Castling castling) {
  return Castling(~(int)castling);
}

constexpr Castling operator&(Castling castling1, Castling castling2) {
  return Castling((int)castling1 & (int)castling2);
}

constexpr Castling operator&(Castling castling, Color color) {
  return Castling(castling & (color == WHITE ? WHITE_CASTLING : BLACK_CASTLING));
}

constexpr Castling& operator&=(Castling &castling1, Castling castling2) {
  return castling1 = Castling((int)castling1 & (int)castling2);
}

constexpr Castling operator|(Castling castling1, Castling castling2) {
  return Castling((int)castling1 | (int)castling2);
}

constexpr Castling& operator|=(Castling &castling1, Castling castling2) {
  return castling1 = Castling((int)castling1 | (int)castling2);
}

enum PieceType {
  KING,
  QUEEN,
  ROOK,
  BISHOP,
  KNIGHT,
  PAWN,

  ALL_PIECES,
  NO_PIECE
};

constexpr PieceType& operator++(PieceType &pieceType) {
  return pieceType = PieceType(pieceType + 1);
}

constexpr PieceType& operator--(PieceType &pieceType) {
  return pieceType = PieceType(pieceType - 1);
}

enum File : int {
  FILE_A,
  FILE_B,
  FILE_C,
  FILE_D,
  FILE_E,
  FILE_F,
  FILE_G,
  FILE_H,

  NO_FILE
};

constexpr File& operator++(File &file) {
  return file = File(file + 1);
}

constexpr File& operator--(File &file) {
  return file = File(file - 1);
}

constexpr File operator+(File file, int inc) {
  return File((int)file + inc);
}

constexpr File operator-(File file, int inc) {
  return File((int)file - inc);
}

enum Rank : int {
  RANK_1,
  RANK_2,
  RANK_3,
  RANK_4,
  RANK_5,
  RANK_6,
  RANK_7,
  RANK_8,

  NO_RANK
};

constexpr Rank& operator++(Rank &rank) {
  return rank = Rank(rank + 1);
}

constexpr Rank& operator--(Rank &rank) {
  return rank = Rank(rank - 1);
}

constexpr Rank operator+(Rank rank, int inc) {
  return Rank((int)rank + inc);
}

constexpr Rank operator-(Rank rank, int inc) {
  return Rank((int)rank - inc);
}

enum Direction : int {
  NORTH =  8,
  EAST  =  1,
  SOUTH = -NORTH,
  WEST  = -EAST,

  NORTH_EAST = NORTH + EAST,
  SOUTH_EAST = SOUTH + EAST,
  SOUTH_WEST = SOUTH + WEST,
  NORTH_WEST = NORTH + WEST
};

enum PinDirection {
  PIN_DIAGONAL,
  PIN_HORIZONTAL,
  PIN_VERTICAL,

  NO_PIN_DIRECTION
};

enum Square : int {
  SQ_A1, SQ_B1, SQ_C1, SQ_D1, SQ_E1, SQ_F1, SQ_G1, SQ_H1,
  SQ_A2, SQ_B2, SQ_C2, SQ_D2, SQ_E2, SQ_F2, SQ_G2, SQ_H2,
  SQ_A3, SQ_B3, SQ_C3, SQ_D3, SQ_E3, SQ_F3, SQ_G3, SQ_H3,
  SQ_A4, SQ_B4, SQ_C4, SQ_D4, SQ_E4, SQ_F4, SQ_G4, SQ_H4,
  SQ_A5, SQ_B5, SQ_C5, SQ_D5, SQ_E5, SQ_F5, SQ_G5, SQ_H5,
  SQ_A6, SQ_B6, SQ_C6, SQ_D6, SQ_E6, SQ_F6, SQ_G6, SQ_H6,
  SQ_A7, SQ_B7, SQ_C7, SQ_D7, SQ_E7, SQ_F7, SQ_G7, SQ_H7,
  SQ_A8, SQ_B8, SQ_C8, SQ_D8, SQ_E8, SQ_F8, SQ_G8, SQ_H8,

  NO_SQUARE
};

constexpr Square& operator++(Square &square) {
  return square = Square(square + 1);
}

constexpr Square& operator--(Square &square) {
  return square = Square(square - 1);
}

constexpr Square operator+(Square square, Direction direction) {
  return Square((int)square + (int)direction);
}

constexpr Square& operator+=(Square &square, Direction direction) {
  return square = Square((int)square + (int)direction);
}

constexpr Square operator-(Square square, Direction direction) {
  return Square((int)square - (int)direction);
}

constexpr Square& operator-=(Square &square, Direction direction) {
  return square = Square((int)square - (int)direction);
}

typedef uint64_t Bitboard;

struct Piece {
  int       index;
  PieceType type;
  Color     color;
  Square    square;
};

typedef uint64_t ZobristKey;

enum Move : int {
  NO_MOVE = 0
};

constexpr Move operator|(Move move, PieceType promotion) {
  return Move((int)move | promotion);
}

constexpr Move& operator|=(Move &move, PieceType promotion) {
  return move = move | promotion;
}

struct MoveInfo {
  Move       move;
  Piece*     movedPiece;
  Piece*     capturedPiece;
  Piece*     castlingRook;
  Bitboard   prevCheckers;
  ZobristKey prevPositionKey;
  ZobristKey prevPawnKey;
  Square     prevPossibleEnPassant;
  Castling   prevPossibleCastling;
  int        prevPliesFor50MoveRule;
};

typedef int PieceSquareTable[64];

enum Score : int {
  SCORE_EQUAL    = 0,
  MATE_SCORE     = 10000000,
  NO_SCORE       = 100000000,
  INFINITE_SCORE = 1000000000
};

constexpr Score operator-(Score score) {
  return Score(-(int)score);
}

constexpr Score operator+(Score score, int increment) {
  return Score((int)score + increment);
}

constexpr Score& operator+=(Score &score, int increment) {
  return score = Score((int)score + increment);
}

constexpr Score operator+(Score score1, Score score2) {
  return Score((int)score1 + (int)score2);
}

constexpr Score& operator+=(Score &score1, Score score2) {
  return score1 = Score((int)score1 + (int)score2);
}

constexpr Score operator-(Score score, int increment) {
  return Score((int)score - increment);
}

constexpr Score& operator-=(Score &score, int increment) {
  return score = Score((int)score - increment);
}

constexpr Score operator-(Score score1, Score score2) {
  return Score((int)score1 - (int)score2);
}

constexpr Score& operator-=(Score &score1, Score score2) {
  return score1 = Score((int)score1 - (int)score2);
}

struct MoveWithScore {
  Move  move = NO_MOVE;
  Score score = NO_SCORE;
};

struct FileInfo {
  Rank min = NO_RANK;
  Rank max = NO_RANK;
};

struct PositionInfo {
  FileInfo            pawnFiles[2][8];
  List<Piece*, 64>    pawns[2];
};

struct MagicAttack {
  Bitboard     attacks[4096];
  Bitboard     magic;
  Bitboard     mask;
  unsigned int shift;
};

struct ControlBitboards {
  Bitboard aroundCenter;
  Bitboard center;
  Bitboard opponent;
  Bitboard unimportant;
};

namespace gameUtils {
  extern PieceSquareTable         allPieceSquareTables[2][6][2];
  extern bool                     areAlignedDiagonally[64][64];
  extern bool                     areAlignedOrthogonally[64][64];
  extern bool                     areAligned[64][64];
  extern bool                     areOnOneLine[64][64][64];
  extern bool                     arePieceAligned[6][64][64];
  extern vector<Square>*          behindSquares[64][64];
  extern Bitboard                 bishopMagics[64];
  extern MagicAttack              bishopMagicAttacks[64];
  extern ControlBitboards         controlBitboards[2];
  const int                       diagonalIncrements[4][2] = {
    {+1, +1},
    {-1, +1},
    {+1, -1},
    {-1, -1}
  };
  extern int                      distances[64][64];
  extern PieceSquareTable         egWhiteKingPieceSquareTable;
  extern Square                   enPassantPieceSquares[64];
  extern Bitboard                 fileBitboards[8];
  extern bool                     isSquareBetween[64][64][64];
  extern vector<Square>*          kingAttacks[64];
  extern Bitboard                 kingAttacks2[64];
  const int                       kingIncrements[8][2] = {
    {+1, +1},
    {-1, +1},
    {+1, -1},
    {-1, -1},
    {+1, +0},
    {-1, +0},
    {+0, +1},
    {+0, -1}
  };
  extern vector<Square>*          knightAttacks[64];
  extern Bitboard                 knightAttacks2[64];
  const int                       knightIncrements[8][2] = {
    {+1, +2},
    {-1, +2},
    {+1, -2},
    {-1, -2},
    {+2, +1},
    {-2, +1},
    {+2, -1},
    {-2, -1}
  };
  extern PieceSquareTable         mgWhitePieceSquareTables[6];
  extern vector<Square>*          middleSquares[64][64];
  extern Bitboard                 middleSquares2[64][64];
  const int                       orthogonalIncrements[4][2] = {
    {+1, +0},
    {-1, +0},
    {+0, +1},
    {+0, -1}
  };
  extern vector<Square>*          pawnAttacks[2][64];
  extern Bitboard                 pawnAttacks2[2][64];
  const string                    pieces = "kqrbnp";
  const int                       piecesWorth[6] = {1000, 16, 8, 5, 5, 1};
  extern Bitboard                 rankBitboards[2][8];
  const Rank                      ranks[2][8] = {
    { RANK_1, RANK_2, RANK_3, RANK_4, RANK_5, RANK_6, RANK_7, RANK_8 },
    { RANK_8, RANK_7, RANK_6, RANK_5, RANK_4, RANK_3, RANK_2, RANK_1 }
  };
  extern Bitboard                 rookMagics[64];
  extern MagicAttack              rookMagicAttacks[64];
  extern vector<vector<Square>*>* slidingAttacks[6][64];
  extern Bitboard                 squareBitboards[64];
  extern int                      squareColors[64];
  extern File                     squareFiles[64];
  extern Rank                     squareRanks[64];
  extern Bitboard                 squareRings[64][2];
  extern Square                   squares[8][8];

  inline File      fileOf(Square square) {
    return File(square & 7);
  };
  inline Square    getBitboardSquare(Bitboard bitboard) {
    return bitboard ? Square(__builtin_ctzll(bitboard)) : NO_SQUARE;
  };
  inline Square    getMoveFrom(Move move) {
    return Square(move >> 9);
  };
  inline PieceType getMovePromotion(Move move) {
    int promotion = move & 7;

    return promotion == 0
      ? NO_PIECE
      : PieceType(promotion);
  };
  inline Square    getMoveTo(Move move) {
    return Square(move >> 3 & 63);
  };
  Bitboard         getSlidingAttacks(Square square, PieceType pieceType, Bitboard blockers);
  inline bool      isSlider(Piece* piece) {
    return piece->type == QUEEN || piece->type == ROOK || piece->type == BISHOP;
  };
  inline bool      isSquareBitboard(Bitboard bitboard) {
    return !(bitboard & (bitboard - 1));
  }
  Square           literalToSquare(const string &square);
  inline Move      move(Square from, Square to) {
    return Move(from << 9 | to << 3);
  };
  string           moveToUci(Move move);
  Square           popBitboardSquare(Bitboard* bitboard);
  void             printBitboard(Bitboard bitboard);
  inline Rank      rankOf(Square square) {
    return Rank(square >> 3);
  }
  inline Square    square(Rank rank, File file) {
    return Square(rank << 3 | file);
  };
  string           squareToLiteral(Square square);
  Move             uciToMove(const string &uci);
  vector<Square>   traverseDirection(Square square, int incrementRank, int incrementFile, bool stopAfter1);
}

inline Bitboard operator&(Bitboard bitboard, Square square) {
  return bitboard & gameUtils::squareBitboards[square];
}

inline Bitboard& operator&=(Bitboard &bitboard, Square square) {
  return bitboard = bitboard & gameUtils::squareBitboards[square];
}

inline Bitboard operator|(Bitboard bitboard, Square square) {
  return bitboard | gameUtils::squareBitboards[square];
}

inline Bitboard& operator|=(Bitboard &bitboard, Square square) {
  return bitboard = bitboard | gameUtils::squareBitboards[square];
}

inline Bitboard operator^(Bitboard bitboard, Square square) {
  return bitboard ^ gameUtils::squareBitboards[square];
}

inline Bitboard& operator^=(Bitboard &bitboard, Square square) {
  return bitboard = bitboard ^ gameUtils::squareBitboards[square];
}

inline bool operator==(Bitboard bitboard, Square square) {
  return bitboard == gameUtils::squareBitboards[square];
}

inline bool operator!=(Bitboard bitboard, Square square) {
  return bitboard != gameUtils::squareBitboards[square];
}

#endif // GAME_UTILS_INCLUDED
