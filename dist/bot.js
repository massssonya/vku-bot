"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const telegraf_1 = require("telegraf");
const filters_1 = require("telegraf/filters");
const documentHandler = require("./handlers/documentHandler.js");
const messageHandler = require("./handlers/messageHandler.js");
const errorHandler = require("./handlers/errorHandler.js");
const bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
exports.bot = bot;
// Обработчики команд
bot.start(messageHandler.handleStart);
bot.help(messageHandler.handleHelp);
// Обработчик документов
bot.on((0, filters_1.message)('document'), documentHandler.handleDocument);
// Обработчик текстовых сообщений
bot.on((0, filters_1.message)('text'), messageHandler.handleText);
// Обработчик ошибок
bot.catch(errorHandler.handleBotError);
