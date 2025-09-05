import { Context } from "telegraf";

class ErrorHandler {
	handleBotError(error: unknown, ctx: Context | undefined): void {
		console.error("❌ Ошибка бота:", error);

		if (ctx && ctx.reply) {
			ctx.reply(
				"⚠️ Произошла непредвиденная ошибка. Попробуйте позже или обратитесь к администратору."
			);
		}
	}
}

export const errorHandler = new ErrorHandler();