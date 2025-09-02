import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { BotContext } from "./types/index.js";
import errorHandler from "./handlers/errorHandler.js";
import messageHandler from "./handlers/messageHandler.js";
import { message } from "telegraf/filters";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
	throw new Error("❌ TELEGRAM_BOT_TOKEN is not set in .env");
}

export const bot = new Telegraf<BotContext>(token);

bot.start(messageHandler.handleStart);
bot.help(messageHandler.handleHelp);
bot.on(message("text"), () => {
	messageHandler.handleText;
});

bot.catch(errorHandler.handleBotError);
