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

protected:
  int                          bishopsCount;
  Piece*                       board[64];
  uint64_t                     castlingKeys[16];
  Piece*                       checkingPiece;
  Piece*                       emptyPiece;
  uint64_t                     enPassantKeys[64];
  bool                         isCheck;
  bool                         isDoubleCheck;
  bool                         isDraw;
  string                       fen;
  unordered_set<uint64_t>      keys;
  Piece*                       kings[2];
  int                          material[2];
  string                       moves;
  int                          pawnCount;
  uint64_t                     pawnKey;
  Piece*                       pieces[2][64];
  int                          pieceCounts[2];
  uint64_t                     pieceKeys[2][6][64];
  int                          pliesFor50MoveRule;
  uint64_t                     positionKey;
  unordered_map<uint64_t, int> positions;
  Castling                     possibleCastling;
  Square                       possibleEnPassant;
  Color                        turn;
  uint64_t                     turnKey;

  uint64_t       generateKey();
  vector<Move>   getAllLegalMoves();
  vector<Square> getAttacks(Piece* piece);
  Piece*         getCheckingPiece();
  vector<Square> getLegalMoves(Piece* piece, bool stopAfter1);
  vector<Square> getPseudoLegalMoves(Piece* piece);
  Piece*         getSliderBehind(Square square1, Square square2, Color color);
  bool           isDirectionBlocked(Square square1, Square square2);
  bool           isEndgame();
  bool           isInCheck();
  bool           isInDoubleCheck();
  bool           isInsufficientMaterial();
  bool           isNoMoves();
  bool           isSquareAttacked(Square square);
  MoveInfo       performMove(Move move);
  void           printBoard();
  void           revertMove(MoveInfo* move);
  void           setStartingData();
};

#endif // GAME_INCLUDED
