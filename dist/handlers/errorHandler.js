"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ErrorHandler {
    handleBotError(error, ctx) {
        console.error("❌ Ошибка бота:", error);
        if (ctx && ctx.reply) {
            ctx.reply("⚠️ Произошла непредвиденная ошибка. Попробуйте позже или обратитесь к администратору.");
        }
    }
}
module.exports = new ErrorHandler();
