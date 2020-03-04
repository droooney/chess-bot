#include <string>
#include <unordered_map>
#include <unordered_set>

#include "gameUtils.h"

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
  int                       bishopsCount;
  Piece*                    board[64];
  ZobristKey                castlingKeys[16];
  Piece*                    checkingPiece;
  ZobristKey                enPassantKeys[64];
  bool                      isCheck;
  bool                      isDoubleCheck;
  bool                      isDraw;
  string                    fen;
  unordered_set<ZobristKey> keys;
  Piece*                    kings[2];
  int                       material[2];
  string                    moves;
  Piece*                    noPiece;
  int                       pawnCount;
  ZobristKey                pawnKey;
  Piece*                    pieces[2][64];
  int                       pieceCounts[2];
  ZobristKey                pieceKeys[2][6][64];
  int                       pliesFor50MoveRule;
  ZobristKey                positionKey;
  vector<ZobristKey>        positions;
  Castling                  possibleCastling;
  Square                    possibleEnPassant;
  Color                     turn;
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
