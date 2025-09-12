import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters'
import fs from "fs";
import { documentHandler } from './handlers/documentHandler';
import { errorHandler } from './handlers/errorHandler';
import { messageHandler } from './handlers/messageHandler';
import { JSONProcessor } from './processors/JSONProcessor';
import { cleanupTempDir, createTempDir } from './utils/temp-utils';
import { CallbackQuery } from 'telegraf/types';
import { CustomContext } from './types/telegraf';
import SessionStorage from './utils/session-storage';
import { AnalysisResult } from './types/json-processor.types';


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

bot.on(message('document'), (ctx) => {
    const processor = new JSONProcessor();
    documentHandler.handleDocument(ctx, processor);
});

bot.on("callback_query", async (ctx) => {
    const callbackQuery = ctx.callbackQuery as CallbackQuery.DataQuery;
    const data = callbackQuery.data;

    const sessionId = data.split('_').pop()!;
    const sessionData = SessionStorage.getBySessionId(sessionId);

    if (!sessionData) {
        return ctx.answerCbQuery("⚠️ Сессия устарела, загрузите JSON заново.");
    }

    const { analysisResult, tempDir, json } = sessionData;

    if (!analysisResult || !json) return;

    const processor = new JSONProcessor();

    if (data === `report_excel_${sessionId}`) {
        
        const files = processor.generateExcel(analysisResult, json, tempDir);

        for (const [type, filepath] of Object.entries(files)) {
            await ctx.replyWithDocument({ source: filepath, filename: `${type}.xlsx` });
        }
        SessionStorage.delete(sessionId);
        setTimeout(() => cleanupTempDir(tempDir), 30000);
    }

    if (data === `report_pdf_${sessionId}`) {
        try {
            const files = await processor.generatePDF(analysisResult, tempDir);
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

bot.on(message('text'), (ctx) => messageHandler.handleText(ctx));

// Обработчик ошибок
bot.catch(errorHandler.handleBotError);

export { bot };
