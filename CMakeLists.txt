cmake_minimum_required(VERSION 3.13)
project(chess-bot)

set(CMAKE_CXX_STANDARD 20)

add_executable(chess-bot
        app/main.cpp
        app/game.cpp app/game.h
        app/utils.cpp app/utils.h
        app/bot.cpp app/bot.h
        app/gameUtils.cpp app/gameUtils.h
        app/init.cpp app/init.h
        app/perft.cpp app/perft.h
)
