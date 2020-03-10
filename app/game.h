#include <string>
#include <unordered_set>

#include "gameUtils.h"
#include "utils.h"

using namespace std;

#ifndef GAME_INCLUDED
#define GAME_INCLUDED

class Game {
public:
  explicit Game(const string &fen);
  ~Game();
  void     applyMoves(const string &moves);
  Move*    getAllLegalMoves(Move* moves);
  MoveInfo performMove(Move move);
  void     revertMove(MoveInfo* move);

protected:
  int                       bishopsCount = 0;
  Bitboard                  bitboards[2][7];
  Piece*                    board[64];
  Bitboard                  boardBitboard = 0ULL;
  ZobristKey                castlingKeys[16];
  Piece*                    checkingPiece;
  ZobristKey                enPassantKeys[64];
  bool                      isCheck = false;
  bool                      isDoubleCheck = false;
  string                    fen;
  unordered_set<ZobristKey> keys;
  Piece*                    kings[2];
  int                       material[2];
  int                       moveCount = 0;
  Piece*                    noPiece = nullptr;
  int                       pawnCount = 0;
  ZobristKey                pawnKey = 0ULL;
  Piece*                    pieces[2][64];
  int                       pieceCounts[2];
  ZobristKey                pieceKeys[2][6][64];
  int                       pliesFor50MoveRule = 0;
  ZobristKey                positionKey = 0ULL;
  List<ZobristKey, 512>     positions;
  Castling                  possibleCastling = NO_CASTLING;
  Square                    possibleEnPassant = NO_SQUARE;
  Color                     turn = WHITE;
  ZobristKey                turnKey;

  ZobristKey generateKey();
  Square*    getAttacks(Square* attacks, Piece* piece);
  Piece*     getCheckingPiece();
  Square*    getLegalMoves(Square* moves, Piece* piece, bool stopAfter1);
  Square*    getPseudoLegalMoves(Square* moves, Piece* piece);
  Piece*     getSliderBehind(Square square1, Square square2, Color color);
  bool       isControlledByOpponentPawn(Square square, Color opponentColor);
  bool       isDirectionBlocked(Square square1, Square square2);
  bool       isDraw();
  bool       isEndgame();
  bool       isInCheck();
  bool       isInDoubleCheck();
  bool       isInsufficientMaterial();
  bool       isNoMoves();
  bool       isSquareAttacked(Square square);
  void       printBoard();
  void       setStartingData();
};

#endif // GAME_INCLUDED
