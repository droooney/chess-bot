#include <iostream>

#include "init.h"
#include "perft.h"

using namespace std;

int main(int argc, char** argv) {
  init::init();

  if (argc > 1 && strcmp(argv[1], "--runPerft") == 0) {
    perft::perftMain();
  }

  return 0;
}
