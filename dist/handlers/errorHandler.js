class ErrorHandler {
    handleBotError(error, ctx) {
        console.error("❌ Ошибка бота:", error);
        if (ctx && ctx.reply) {
            ctx.reply("⚠️ Произошла непредвиденная ошибка. Попробуйте позже или обратитесь к администратору.");
        }
    }
}
export default new ErrorHandler();
