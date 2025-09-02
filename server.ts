import express from "express";
import { bot } from "./bot.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("✅ Telegram bot is running on Render!");
});

// Вебхук
app.post(`/telegram/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Устанавливаем вебхук (нужно при первом запуске)
const setWebhook = async () => {
  const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/telegram/${process.env.TELEGRAM_BOT_TOKEN}`;
  await bot.telegram.setWebhook(url);
  console.log(`📡 Webhook установлен: ${url}`);
};

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await setWebhook();
});
