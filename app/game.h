#include <string>
#include <unordered_map>
#include <unordered_set>

#include "gameUtils.h"
#include "utils.h"

using namespace std;

#ifndef GAME_INCLUDED
#define GAME_INCLUDED

class Game {
public:
  Game(const string &fen, const string &moves);
  ~Game();
  Move*    getAllLegalMoves(Move* moveList);
  MoveInfo performMove(Move move);
  void     revertMove(MoveInfo* move);

protected:
  int                       bishopsCount = 0;
  Piece*                    board[64];
  ZobristKey                castlingKeys[16];
  Piece*                    checkingPiece;
  ZobristKey                enPassantKeys[64];
  bool                      isCheck = false;
  bool                      isDoubleCheck = false;
  bool                      isDraw = false;
  string                    fen;
  unordered_set<ZobristKey> keys;
  Piece*                    kings[2];
  int                       material[2];
  string                    moves;
  Piece*                    noPiece = new Piece({
                              .index  = -1,
                              .type   = NO_PIECE,
                              .color  = NO_COLOR,
                              .square = NO_SQUARE
                            });
  int                       pawnCount = 0;
  ZobristKey                pawnKey = 0ULL;
  Piece*                    pieces[2][64];
  int                       pieceCounts[2];
  ZobristKey                pieceKeys[2][6][64];
  int                       pliesFor50MoveRule = 0;
  ZobristKey                positionKey = 0ULL;
  List<ZobristKey, 256>     positions = List<ZobristKey, 256>();
  Castling                  possibleCastling = NO_CASTLING;
  Square                    possibleEnPassant = NO_SQUARE;
  Color                     turn = WHITE;
  ZobristKey                turnKey;

  ZobristKey     generateKey();
  vector<Square> getAttacks(Piece* piece);
  Piece*         getCheckingPiece();
  Square*        getLegalMoves(Square* squareList, Piece* piece, bool stopAfter1);
  Square*        getPseudoLegalMoves(Square* squareList, Piece* piece);
  Piece*         getSliderBehind(Square square1, Square square2, Color color);
  bool           isDirectionBlocked(Square square1, Square square2);
  bool           isEndgame();
  bool           isInCheck();
  bool           isInDoubleCheck();
  bool           isInsufficientMaterial();
  bool           isNoMoves();
  bool           isSquareAttacked(Square square);
  void           printBoard();
  void           setStartingData();
};

#endif // GAME_INCLUDED
