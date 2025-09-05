"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const telegraf_1 = require("telegraf");
const filters_1 = require("telegraf/filters");
const documentHandler_1 = require("./handlers/documentHandler");
const errorHandler_1 = require("./handlers/errorHandler");
const messageHandler_1 = require("./handlers/messageHandler");
const bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
exports.bot = bot;
// Обработчики команд
bot.start(messageHandler_1.messageHandler.handleStart);
bot.help(messageHandler_1.messageHandler.handleHelp);
bot.on((0, filters_1.message)('document'), (ctx) => documentHandler_1.documentHandler.handleDocument(ctx));
bot.on((0, filters_1.message)('text'), (ctx) => messageHandler_1.messageHandler.handleText(ctx));
// Обработчик ошибок
bot.catch(errorHandler_1.errorHandler.handleBotError);
