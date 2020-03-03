#include <iostream>
#include <string>
#include <vector>

#include "utils.h"

using namespace std;

int utils::sign(int number) {
  return (number > 0) - (number < 0);
}

vector<string> utils::split(const string &str, const string &delimiter) {
  vector<string> split;

  size_t start = 0;
  size_t end = str.find(delimiter);

  while (end != string::npos) {
    split.push_back(str.substr(start, end - start));

    start = end + delimiter.length();
    end = str.find(delimiter, start);
  }

  split.push_back(str.substr(start));

  return split;
}
