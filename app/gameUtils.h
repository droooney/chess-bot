#include <string>
#include <vector>

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

constexpr Color operator++(Color &color) {
  return color = Color(color + 1);
}

constexpr Color operator--(Color &color) {
  return color = Color(color - 1);
}

enum Castling {
  NO_CASTLING,

  WHITE_OO,
  WHITE_OOO = WHITE_OO << 1,
  BLACK_OO  = WHITE_OO << 2,
  BLACK_OOO = WHITE_OO << 3,

  ANY_OO = WHITE_OO | BLACK_OO,
  ANY_OOO = WHITE_OOO | BLACK_OOO,
  WHITE_CASTLING = WHITE_OO  | WHITE_OOO,
  BLACK_CASTLING = BLACK_OO  | BLACK_OOO,

  ANY_CASTLING = WHITE_CASTLING | BLACK_CASTLING
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

constexpr Castling operator&=(Castling &castling1, Castling castling2) {
  return castling1 = castling1 & castling2;
}

constexpr Castling operator|(Castling castling1, Castling castling2) {
  return Castling((int)castling1 | (int)castling2);
}

constexpr Castling operator|=(Castling &castling1, Castling castling2) {
  return castling1 = castling1 | castling2;
}

enum PieceType {
  KING,
  QUEEN,
  ROOK,
  BISHOP,
  KNIGHT,
  PAWN,

  NO_PIECE
};

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

constexpr File operator++(File &file) {
  return file = File(file + 1);
}

constexpr File operator--(File &file) {
  return file = File(file - 1);
}

constexpr File operator+(File file, int inc) {
  return File((int)file + inc);
}

constexpr File operator-(File file, int inc) {
  return file + -inc;
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

constexpr Rank operator++(Rank &rank) {
  return rank = Rank(rank + 1);
}

constexpr Rank operator--(Rank &rank) {
  return rank = Rank(rank - 1);
}

constexpr Rank operator+(Rank rank, int inc) {
  return Rank((int)rank + inc);
}

constexpr Rank operator-(Rank rank, int inc) {
  return rank + -inc;
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

constexpr Square operator++(Square &square) {
  return square = Square(square + 1);
}

constexpr Square operator--(Square &square) {
  return square = Square(square - 1);
}

constexpr Square operator+(Square square, Direction direction) {
  return Square((int)square + (int)direction);
}

constexpr Square operator+=(Square &square, Direction direction) {
  return square = square + direction;
}

constexpr Square operator-(Square square, Direction direction) {
  return Square((int)square - (int)direction);
}

constexpr Square operator-=(Square &square, Direction direction) {
  return square = square - direction;
}

struct Piece {
  int       index;
  PieceType type;
  Color     color;
  Square    square;
};

typedef uint64_t ZobristKey;

enum Move : int {

};

constexpr Move operator|(Move move, PieceType promotion) {
  return Move((int)move | promotion);
}

constexpr Move operator|=(Move &move, PieceType promotion) {
  return move = move | promotion;
}

struct MoveInfo {
  Move       move;
  Piece*     movedPiece;
  Piece*     capturedPiece;
  Piece*     castlingRook;
  bool       wasCheck;
  bool       wasDoubleCheck;
  Piece*     prevCheckingPiece;
  ZobristKey prevPositionKey;
  ZobristKey prevPawnKey;
  Square     prevPossibleEnPassant;
  Castling   prevPossibleCastling;
  int        prevPliesFor50MoveRule;
};

typedef int PieceSquareTable[64];

namespace gameUtils {
  extern PieceSquareTable          allPieceSquareTables[2][6][2];
  extern vector<Square>*           behindSquares[64][64];
  const int                        diagonalIncrements[4][2] = {
    {+1, +1},
    {-1, +1},
    {+1, -1},
    {-1, -1}
  };
  extern PieceSquareTable          egWhiteKingPieceSquareTable;
  extern vector<Square>*           kingAttacks[64];
  const int                        kingIncrements[8][2] = {
    {+1, +1},
    {-1, +1},
    {+1, -1},
    {-1, -1},
    {+1, +0},
    {-1, +0},
    {+0, +1},
    {+0, -1}
  };
  extern vector<Square>*           knightAttacks[64];
  const int                        knightIncrements[8][2] = {
    {+1, +2},
    {-1, +2},
    {+1, -2},
    {-1, -2},
    {+2, +1},
    {-2, +1},
    {+2, -1},
    {-2, -1}
  };
  extern vector<Square>*           middleSquares[64][64];
  const int                        orthogonalIncrements[4][2] = {
    {+1, +0},
    {-1, +0},
    {+0, +1},
    {+0, -1}
  };
  extern vector<Square>*           pawnAttacks[2][64];
  extern PieceSquareTable          mgWhitePieceSquareTables[6];
  const string                     pieces = "kqrbnp";
  const int                        piecesWorth[6] = {1000, 16, 8, 5, 5, 1};
  extern vector<vector<Square>*>*  slidingAttacks[6][64];

  bool             areAlignedDiagonally(Square square1, Square square2);
  bool             areAlignedOrthogonally(Square square1, Square square2);
  bool             areAligned(Square square1, Square square2);
  bool             areOnOneLine(Square square1, Square square2, Square square3);
  bool             arePieceAligned(Square square1, Square square2, PieceType pieceType);
  Square           getEnPassantPieceSquare(Square enPassantSquare);
  int              getDistance(Square square1, Square square2);
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
  bool             isSquareBetween(Square square1, Square square2, Square square3);
  inline bool      isPiece(Piece* piece) {
    return piece->type != NO_PIECE;
  };
  inline bool      isSlider(Piece* piece) {
    return piece->type == QUEEN || piece->type == ROOK || piece->type == BISHOP;
  };
  inline File      fileOf(Square square) {
    return File(square & 7);
  };
  Square           literalToSquare(const string &square);
  inline Move      move(Square from, Square to) {
    return Move(from << 9 | to << 3);
  };
  string           moveToUci(Move move);
  inline Rank      rank1(Color color) {
    return color == WHITE ? RANK_1 : RANK_8;
  };
  inline Rank      rank2(Color color) {
    return color == WHITE ? RANK_2 : RANK_7;
  };
  inline Rank      rank4(Color color) {
    return color == WHITE ? RANK_4 : RANK_5;
  };
  inline Rank      rank7(Color color) {
    return color == WHITE ? RANK_7 : RANK_2;
  };
  inline Rank      rank8(Color color) {
    return color == WHITE ? RANK_8 : RANK_1;
  };
  inline Rank      rankOf(Square square) {
    return Rank(square >> 3);
  }
  inline Square    square(Rank rank, File file) {
    return Square(rank << 3 | file);
  };
  int              squareColor(Square square);
  string           squareToLiteral(Square square);
  Move             uciToMove(const string &uci);
  vector<Square>   traverseDirection(Square square, int incrementRank, int incrementFile, bool stopAfter1);
}

#endif // GAME_UTILS_INCLUDED
