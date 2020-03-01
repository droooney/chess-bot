cmake_minimum_required(VERSION 3.13)
project(chess-bot)

set(CMAKE_CXX_STANDARD 20)

add_executable(chess-bot
        app/game.cpp app/game.h
        app/utils.cpp app/utils.h
        app/api.cpp app/api.h
        app/bot.cpp app/bot.h
        app/gameUtils.cpp app/gameUtils.h
        app/init.cpp app/init.h
        )
include_directories(node_modules/node-addon-api node_modules/node-addon-api/external-napi)