#include <iostream>
#include <string>
#include <vector>

#ifndef UTILS_INCLUDED
#define UTILS_INCLUDED

using namespace std;

template<typename T>
ostream& operator<<(ostream &out, const vector<T> &v) {
  out << "{";

  size_t last = v.size() - 1;

  for (size_t i = 0; i < v.size(); i++) {
    out << v[i];

    if (i != last) {
      out << ", ";
    }
  }

  out << "}";

  return out;
}

namespace utils {
  int            sign(int number);
  vector<string> split(const string &str, const string &delimiter);
}

#endif // UTILS_INCLUDED
