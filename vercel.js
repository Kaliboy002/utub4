{
    "version": 2,
    "builds": [
        {
            "src": "api/bot.js",
            "use": "@vercel/node"
        }
    ],
    "routes": [
        {
            "src": "/api/bot",
            "dest": "/api/bot.js"
        }
    ],
    "env": {
        "TELEGRAM_TOKEN": "@telegram-token",
        "VERCEL_URL": "@vercel-url"
    }
}
