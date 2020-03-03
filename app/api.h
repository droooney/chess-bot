#include <string>
#include <napi.h>

#ifndef API_INCLUDED
#define API_INCLUDED

using namespace std;

namespace api {
  void parseFen(const string &fen, const string &position);

  void parseFenWrapped(const Napi::CallbackInfo &info);
}

Napi::Object Init(Napi::Env env, Napi::Object exports);

#endif // API_INCLUDED
