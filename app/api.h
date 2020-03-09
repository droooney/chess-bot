#include <string>
#include <napi.h>

#include "bot.h"

#ifndef API_INCLUDED
#define API_INCLUDED

using namespace std;

namespace api {
  class BotWrapper : public Napi::ObjectWrap<BotWrapper> {
  public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    explicit            BotWrapper(const Napi::CallbackInfo &info);

  private:
    static Napi::FunctionReference constructor;
    void                           ApplyMoves(const Napi::CallbackInfo &info);
    Napi::Value                    MakeMove(const Napi::CallbackInfo &info);
    Bot* bot;
  };
}

Napi::Object Init(Napi::Env env, Napi::Object exports);

#endif // API_INCLUDED
