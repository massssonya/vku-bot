import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters'
import { documentHandler } from './handlers/documentHandler';
import { errorHandler } from './handlers/errorHandler';
import { messageHandler } from './handlers/messageHandler';


const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Обработчики команд
bot.start(messageHandler.handleStart);
bot.help(messageHandler.handleHelp);


bot.on(message('document'), (ctx) => documentHandler.handleDocument(ctx));
bot.on(message('text'), (ctx) => messageHandler.handleText(ctx));

// Обработчик ошибок
bot.catch(errorHandler.handleBotError);

export { bot };
