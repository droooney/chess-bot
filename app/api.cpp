#include <string>
#include <napi.h>

#include "api.h"
#include "game.h"
#include "init.h"

using namespace std;

void api::parseFen(const string &fen, const string &position) {
  Game game = Game(fen, position);
}

void api::parseFenWrapped(const Napi::CallbackInfo& info) {
  string fen = info[0].As<Napi::String>();
  string position = info[1].As<Napi::String>();

  api::parseFen(fen, position);
}

Napi::Object initAddonApi(Napi::Env env, Napi::Object exports) {
  init::init();

  exports.Set("parseFen", Napi::Function::New(env, api::parseFenWrapped));

  return exports;
}

NODE_API_MODULE(addon, initAddonApi);
