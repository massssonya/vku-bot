import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("❌ TELEGRAM_BOT_TOKEN is not set in .env");
}

export const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply("Привет 👋 Я твой бот на Render!"));
bot.help((ctx) => ctx.reply("Я понимаю команды /start и /help."));
