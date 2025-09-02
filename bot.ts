import { Telegraf } from "telegraf";

const token = process.env.TELEGRAM_BOT_TOKEN as string;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
}

export const bot = new Telegraf(token);

// Команды
bot.start((ctx) => ctx.reply("Привет! Я ваш Telegram-бот 🚀"));
bot.help((ctx) =>
  ctx.reply("Доступные команды:\n/start — запуск\n/help — помощь")
);
