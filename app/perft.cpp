#include <chrono>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

#include "game.h"
#include "gameUtils.h"
#include "perft.h"
#include "utils.h"

using namespace std;
using namespace std::chrono;

string initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
int DEPTH = 6;
unordered_map<string, int> realMap = {};
bool checkPosition = false;
bool debug = false;

vector<PerfTest> tests = {
  {
    .initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    .nodeCounts = {20, 400, 8902, 197281, 4865609}
  },
  {
    .initialFen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    .nodeCounts = {48, 2039, 97862, 4085603}
  },
  {
    .initialFen = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    .nodeCounts = {14, 191, 2812, 43238, 674624, 11030083}
  },
  {
    .initialFen = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    .nodeCounts = {6, 264, 9467, 422333, 15833292}
  },
  {
    .initialFen = "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1",
    .nodeCounts = {6, 264, 9467, 422333, 15833292}
  },
  {
    .initialFen = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    .nodeCounts = {44, 1486, 62379, 2103487}
  },
  {
    .initialFen = "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    .nodeCounts = {46, 2079, 89890, 3894594}
  },
  {
    .initialFen = "rnbq1k1r/pp1P1ppp/2p5/8/2B4b/P7/1PP1NnPP/RNBQK2R w KQ - 1 9",
    .nodeCounts = {42, 1432, 51677, 1747286}
  },
  {
    .initialFen = "3b4/2P5/8/8/8/2n5/8/2k1K2R w K - 0 1",
    .nodeCounts = {20, 268, 5464, 69692, 1490361}
  },
  {
    .initialFen = "6b1/5P2/8/8/3n1k2/8/8/4K2R w K - 0 1",
    .nodeCounts = {22, 325, 6839, 96270, 2148378}
  },
  {
    .initialFen = "8/p3p3/1b1k4/3P1p2/8/8/1n3B2/2KR4 w - - 0 1",
    .nodeCounts = {19, 326, 5853, 99157, 1905025}
  },
  {
    .initialFen = "8/p3p3/3k4/3P1p2/8/8/5B2/K7 w - - 0 1",
    .nodeCounts = {12, 99, 1262, 11208, 150846, 1366710}
  }
};

// long long int calculateLegalMovesTime = 0LL;
// long long int performMoveTime = 0LL;
// long long int revertMoveTime = 0LL;

int perft::perft(string initialFen, int depth, bool useMap) {
  auto timestamp = high_resolution_clock::now();
  Game game = Game(initialFen);
  function<int(int)> calculateNodes = [&](int depth) {
    if (depth == 0) {
      return 1;
    }

    int nodes = 0;

    // auto timestamp = high_resolution_clock::now();

    List<Move, 256> legalMoves;

    legalMoves.last = game.getAllLegalMoves(legalMoves.list);

    // calculateLegalMovesTime += duration_cast<nanoseconds>(high_resolution_clock::now() - timestamp).count();

    for (auto &move : legalMoves) {
      // auto timestamp = high_resolution_clock::now();

      MoveInfo moveInfo = game.performMove(move);

      // performMoveTime += duration_cast<nanoseconds>(high_resolution_clock::now() - timestamp).count();

      int moveNodes = calculateNodes(depth - 1);

      nodes += moveNodes;

      // timestamp = high_resolution_clock::now();

      game.revertMove(&moveInfo);

      // revertMoveTime += duration_cast<nanoseconds>(high_resolution_clock::now() - timestamp).count();

      if (useMap && depth == DEPTH) {
        string uci = gameUtils::moveToUci(move);

        if (realMap[uci] == 0) {
          cout << uci << " is not a real move!" << endl;
        } else {
          if (realMap[uci] != moveNodes) {
            cout << uci << " has " << moveNodes << " nodes, real one has " << realMap[uci] << endl;
          }

          realMap.erase(uci);
        }
      }
    }

    if (useMap && depth == DEPTH) {
      if (!realMap.empty()) {
        vector<string> moves;

        for (auto &[move, _] : realMap) {
          moves.push_back(move);
        }

        cout << "no moves were generated for " << moves << endl;
      }
    }

    return nodes;
  };

  if (false) {
    MoveInfo moveInfo = game.performMove(gameUtils::uciToMove("a4b3"));
    List<Move, 256> legalMoves;

    legalMoves.last = game.getAllLegalMoves(legalMoves.list);

    for (auto &move : legalMoves) {
      cout << gameUtils::moveToUci(move) << ", ";
    }

    cout << endl;

    game.revertMove(&moveInfo);
  }

  int nodes = calculateNodes(depth);
  auto time = high_resolution_clock::now();
  auto duration = duration_cast<nanoseconds>(time - timestamp).count();

  cout
    << "fen: " << initialFen << endl
    << "depth: " << depth << endl
    << "nodes: " << nodes << endl
    << "time: " << duration / 1e6 << " ms" << endl
    << "perft: " << nodes * 1e6 / duration << " kn/s" << endl;

  return nodes;
}

void perft::perftMain() {
  auto timestamp = high_resolution_clock::now();
  int sumNodes = 0;

  if (checkPosition) {
    for (int i = debug ? DEPTH : 1; i <= DEPTH; i++) {
      perft::perft(initialFen, i, debug);
    }
  } else {
    for (auto &[initialFen, nodeCounts] : tests) {
      for (int i = 1; i <= nodeCounts.size(); i++) {
        int nodes = perft::perft(initialFen, i, false);
        int expected = nodeCounts[i - 1];

        sumNodes += nodes;

        if (nodes != expected) {
          cout << "invalid node count. fen: " << initialFen << ", expected " << expected << ", got " << nodes << endl;

          exit(1);
        }
      }
    }
  }

  auto time = high_resolution_clock::now();
  auto duration = duration_cast<nanoseconds>(time - timestamp).count();

  cout << "test took " << duration / 1e6 << " ms" << endl;
  cout << "sum perft: " << sumNodes * 1e6 / duration << " kn/s" << endl;
  // cout << "calculateLegalMoves took " << calculateLegalMovesTime / 1e6 << " ms" << endl;
  // cout << "performMove took " << performMoveTime / 1e6 << " ms" << endl;
  // cout << "revertMove took " << revertMoveTime / 1e6 << " ms" << endl;
}
