import { Telegraf } from "telegraf";
import dotenv from "dotenv";
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
bot.on("message", (ctx) => {
    const message = ctx.message;
    if (!message)
        return;
    if ("document" in message) {
        documentHandler.handleDocument(ctx);
    }
    else {
        messageHandler.handleText(ctx);
    }
});
bot.catch(errorHandler.handleBotError);
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
