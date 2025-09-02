import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { DocumentContext } from "./types/index.js";
import errorHandler from "./handlers/errorHandler.js";
import messageHandler from "./handlers/messageHandler.js";
import documentHandler from "./handlers/documentHandler.js";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
	throw new Error("❌ TELEGRAM_BOT_TOKEN is not set in .env");
}

export const bot = new Telegraf(token);

bot.start(messageHandler.handleStart);
bot.help(messageHandler.handleHelp);
bot.on("message", messageHandler.handleText);

bot.on("message", (ctx) => {
	if ("document" in ctx.message)
		documentHandler.handleDocument(ctx as DocumentContext);
});

bot.catch(errorHandler.handleBotError);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
