"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
class ErrorHandler {
    handleBotError(error, ctx) {
        console.error("❌ Ошибка бота:", error);
        if (ctx && ctx.reply) {
            ctx.reply("⚠️ Произошла непредвиденная ошибка. Попробуйте позже или обратитесь к администратору.");
        }
    }
}
exports.errorHandler = new ErrorHandler();
