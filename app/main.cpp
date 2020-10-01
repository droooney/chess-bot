#include <iostream>

// #include "bot.h"
// #include "gameUtils.h"
#include "init.h"
#include "perft.h"

using namespace std;

int main(int argc, char** argv) {
  init::init();

  if (argc > 1 && strcmp(argv[1], "--runPerft") == 0) {
    perft::perftMain();
  } else {
    // Bot bot("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", BLACK, 4 * 2);
    //
    // bot.applyMoves("e2e4");
    // bot.makeMove();
  }

  return 0;
}
