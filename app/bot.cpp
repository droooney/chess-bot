#include <string>
#include <vector>

#include "game.h"
#include "bot.h"

using namespace std;

Bot::Bot(const string &fen, const string &moves) : Game(fen, moves) {

}

vector<string> Bot::getOptimalMoves() {
  vector<string> moves;

  return moves;
}
