import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters'
import fs from "fs";
import { documentHandler } from './handlers/documentHandler';
import { errorHandler } from './handlers/errorHandler';
import { messageHandler } from './handlers/messageHandler';
import { JSONProcessorObj } from './processors/JSONProcessor';
import { cleanupTempDir, createTempDir } from './utils/temp-utils';
import { CallbackQuery } from 'telegraf/types';
import { CustomContext } from './types/telegraf';
import SessionStorage from './utils/session-storage';


const bot = new Telegraf<CustomContext>(process.env.TELEGRAM_BOT_TOKEN || '');

// Обработчики команд
bot.start(messageHandler.handleStart);
bot.help(messageHandler.handleHelp);

bot.command("jsonlogic", async (ctx) => {
    const chatId = ctx.chat.id;

    let session = SessionStorage.getByChatId(chatId);
    if (!session) {
        let sessionId = SessionStorage.create({
            chatId,
            tempDir: createTempDir(),
            awaitingJsonLogic: false
        })
        session = SessionStorage.getBySessionId(sessionId)
    }
    if (session) session.awaitingJsonLogic = true;

    await ctx.reply("Пришлите ваше условие для преобразования в JsonLogic");
})

bot.on(message('document'), (ctx) => documentHandler.handleDocument(ctx));
bot.on(message('text'), (ctx) => messageHandler.handleText(ctx));

bot.on("callback_query", async (ctx) => {
    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    const data = callbackQuery.data;

    const sessionId = data.split('_').pop()!;
    const sessionData = SessionStorage.getBySessionId(sessionId);



    if (!sessionData) {
        return ctx.answerCbQuery("⚠️ Сессия устарела, загрузите JSON заново.");
    }

    const { json, diagnostics, unreachable, tempDir } = sessionData;

    if (!diagnostics || !unreachable || !json) return;

    if (data === `report_excel_${sessionId}`) {
        const files = JSONProcessorObj.generateExcelReports(tempDir, diagnostics, unreachable, json);
        for (const [type, filepath] of Object.entries(files)) {
            await ctx.replyWithDocument({ source: filepath, filename: `${type}.xlsx` });
        }
        SessionStorage.delete(sessionId);
        setTimeout(() => cleanupTempDir(tempDir), 30000);
    }

    if (data === `report_pdf_${sessionId}`) {
        try {
            const files = await JSONProcessorObj.generatePDFReports(tempDir, diagnostics, unreachable);
            if (fs.existsSync(files.summary)) {
                await ctx.replyWithDocument({
                    source: files.summary,
                    filename: "report.pdf"
                });
            } else {
                await ctx.reply("❌ Ошибка: PDF файл не был создан");
            }
            SessionStorage.delete(sessionId);
            setTimeout(() => cleanupTempDir(tempDir), 30000);
        } catch (error) {
            console.error("Ошибка генерации PDF:", error);
            await ctx.reply("❌ Произошла ошибка при создании PDF отчета");
        }
    }

    await ctx.answerCbQuery();
});


// Обработчик ошибок
bot.catch(errorHandler.handleBotError);

export { bot };
