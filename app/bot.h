#include <ctime>
#include <string>
#include <unordered_map>
#include <vector>

#include "game.h"
#include "gameUtils.h"

#ifndef BOT_INCLUDED
#define BOT_INCLUDED

using namespace std;

class Bot : public Game {
public:
  Bot(const string &fen, Color color, int searchDepth);
  Move makeMove();

protected:
  Color                            color;
  int                              cutNodesCount = 0;
  unordered_map<ZobristKey, Score> evaluatedPawnPositions[2];
  unordered_map<ZobristKey, Score> evaluatedPositions;
  int                              firstCutNodesCount = 0;
  int                              nodes = 0;
  int                              searchDepth;

  Score     eval(int depth);
  Score     evalColor(Color color, PositionInfo* positionInfo);
  Score     evalKingSafety(Color color);
  Score     evalPawns(Color color, PositionInfo* positionInfo);
  Score     evalPieces(Color color, PositionInfo* positionInfo);
  Score     executeNegamax(int depth, Score alpha, Score beta);
  PieceType getLeastWorthAttacker(Bitboard* attackers, Color color);
  Score     getMateScore(int depth);
  Move      getOptimalMove();
  string    getScore(Score score);
  bool      isMateScore(Score score);
  Score     moveScore(Move move, bool isEndgame);
};

#endif // BOT_INCLUDED
