#include <iostream>
#include <string>
#include <vector>

#include "utils.h"

using namespace std;

string utils::formatString(const string &str, vector<string> formats) {
  string result = str;

  for (auto &format : formats) {
    if (format == "bold") {
      result = "\u001b[1m" + result + "\u001b[22m";
    } else if (format == "red") {
      result = "\u001b[31m" + result + "\u001b[39m";
    } else if (format == "green") {
      result = "\u001b[32m" + result + "\u001b[39m";
    } else if (format == "blue") {
      result = "\u001b[34m" + result + "\u001b[39m";
    } else if (format == "magenta") {
      result = "\u001b[35m" + result + "\u001b[39m";
    }
  }

  return result;
}

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
