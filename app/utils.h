#include <iostream>
#include <string>
#include <vector>

#ifndef UTILS_INCLUDED
#define UTILS_INCLUDED

using namespace std;

template<typename T, int Size>
struct List {
public:
  T  list[Size];
  T* last = list;

  const T* begin() const {
    return this->list;
  }
  bool     contains(T move) const {
    return find(this->begin(), this->end(), move) != end();
  }
  bool     empty() const {
    return this->last == this->list;
  }
  const T* end() const {
    return this->last;
  }
  void     insert(const T &value, size_t index) {
    size_t size = this->size();

    this->last++;

    if (size > 0) {
      for (size_t i = size - 1; i < size && i >= index; i--) {
        this->list[i + 1] = this->list[i];
      }
    }

    this->list[index] = value;
  }
  T        pop() {
    T prev = *--this->last;

    *this->last = T();

    return prev;
  }
  void     push(const T &value) {
    *this->last++ = value;
  }
  size_t   size() const {
    return this->last - this->list;
  }

  T&       operator[](size_t at) {
    return this->list[at];
  }
  const T& operator[](size_t at) const {
    return this->list[at];
  }
};

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
  string         formatString(const string &str, vector<string> formats);
  int            sign(int number);
  vector<string> split(const string &str, const string &delimiter);
}

#endif // UTILS_INCLUDED
