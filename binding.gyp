{
    "targets": [{
        "target_name": "addon",
        "cflags!": ["-fno-exceptions"],
        "cflags_cc!": ["-fno-exceptions"],
        "sources": [
            "app/api.cpp",
            "app/bot.cpp",
            "app/game.cpp",
            "app/gameUtils.cpp",
            "app/init.cpp",
            "app/utils.cpp"
        ],
        "include_dirs": [
            "<!@(node -p \"require('node-addon-api').include\")"
        ],
        "libraries": [],
        "dependencies": [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"]
    }]
}
