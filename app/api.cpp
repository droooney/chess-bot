#include <string>
#include <napi.h>

#include "api.h"
#include "bot.h"
#include "gameUtils.h"
#include "init.h"

using namespace std;

Napi::FunctionReference api::BotWrapper::constructor;

Napi::Object api::BotWrapper::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "Bot", {
    InstanceMethod("applyMoves", &api::BotWrapper::ApplyMoves),
    InstanceMethod("destroy", &api::BotWrapper::Destroy),
    InstanceMethod("makeMove", &api::BotWrapper::MakeMove),
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("default", func);

  return exports;
}

api::BotWrapper::BotWrapper(const Napi::CallbackInfo &info) : Napi::ObjectWrap<BotWrapper>(info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  Napi::String fen = info[0].As<Napi::String>();
  Napi::Number color = info[1].As<Napi::Number>();
  Napi::Number searchDepth = info[2].As<Napi::Number>();

  this->bot = new Bot(string(fen), Color(color.Int32Value()), searchDepth.Int32Value());
}

api::BotWrapper::~BotWrapper() {
  this->destroy();
}

void api::BotWrapper::destroy() {
  delete this->bot;
}

void api::BotWrapper::ApplyMoves(const Napi::CallbackInfo &info) {
  Napi::String moves = info[0].As<Napi::String>();

  this->bot->applyMoves(string(moves));
}

void api::BotWrapper::Destroy(const Napi::CallbackInfo &info) {
  this->destroy();
}

Napi::Value api::BotWrapper::MakeMove(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Move move = this->bot->makeMove();

  return move == NO_MOVE
    ? env.Null()
    : Napi::Number::New(env, move);
}

Napi::Object initAddonApi(Napi::Env env, Napi::Object exports) {
  init::init();

  api::BotWrapper::Init(env, exports);

  return exports;
}

NODE_API_MODULE(addon, initAddonApi);
