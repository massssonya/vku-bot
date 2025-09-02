import { BotContext } from '../types/index.js';

class ErrorHandler {
  handleBotError(error: unknown, ctx: BotContext | undefined): void {
    console.error('❌ Ошибка бота:', error);

    if (ctx && ctx.reply) {
      ctx.reply('⚠️ Произошла непредвиденная ошибка. Попробуйте позже или обратитесь к администратору.');
    }
  }
}

export default new ErrorHandler();
