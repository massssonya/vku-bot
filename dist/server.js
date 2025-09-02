import express from "express";
import { bot } from "./bot.js";
import dotenv from "dotenv";
import { cleanupTempFiles } from "./utils/tempUtils.js";
dotenv.config();
const app = express();
app.use(express.json());
app.get("/", (_, res) => res.send("✅ Бот работает через Render Webhook"));
app.post(`/telegram/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    if (process.env.RENDER_EXTERNAL_URL) {
        const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/telegram/${process.env.TELEGRAM_BOT_TOKEN}`;
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`🌍 Webhook установлен: ${webhookUrl}`);
    }
    else {
        // Для локалки можно запускать через polling
        await bot.launch().then(() => {
            console.log("🤖 Бот запущен!");
            // Очистка временных файлов при запуске
            cleanupTempFiles();
        });
        console.log("🤖 Бот запущен в режиме polling (локально)");
    }
});
