#include <string>
#include <vector>

#ifndef PERFT_INCLUDED
#define PERFT_INCLUDED

using namespace std;

struct PerfTest {
  string      initialFen;
  vector<int> nodeCounts;
};

namespace perft {
  int  perft(string initialFen, int depth, bool useMap);
  void perftMain();
}

#endif // PERFT_INCLUDED
