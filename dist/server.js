"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const bot_js_1 = require("./bot.js");
const tempUtils_js_1 = require("./utils/tempUtils.js");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/", (_, res) => res.send("✅ Бот работает через Render Webhook"));
app.post(`/telegram/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
    bot_js_1.bot.handleUpdate(req.body);
    res.sendStatus(200);
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    if (process.env.RENDER_EXTERNAL_URL) {
        const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/telegram/${process.env.TELEGRAM_BOT_TOKEN}`;
        await bot_js_1.bot.telegram.setWebhook(webhookUrl);
        console.log(`🌍 Webhook установлен: ${webhookUrl}`);
    }
    else {
        // Для локалки можно запускать через polling
        await bot_js_1.bot.launch().then(() => {
            console.log("🤖 Бот запущен!");
            // Очистка временных файлов при запуске
            (0, tempUtils_js_1.cleanupTempFiles)();
        });
        console.log("🤖 Бот запущен в режиме polling (локально)");
    }
});
