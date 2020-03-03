#include <string>
#include <vector>

#include "game.h"

#ifndef BOT_INCLUDED
#define BOT_INCLUDED

using namespace std;

class Bot : public Game {
public:
  Bot(const string &fen, const string &moves);
  vector<string> getOptimalMoves();
};

#endif // BOT_INCLUDED
