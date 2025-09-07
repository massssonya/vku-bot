import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters'
import { documentHandler } from './handlers/documentHandler';
import { errorHandler } from './handlers/errorHandler';
import { messageHandler } from './handlers/messageHandler';
import { JSONProcessorObj } from './processors/JSONProcessor';
import { cleanupTempDir } from './utils/tempUtils';


const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Обработчики команд
bot.start(messageHandler.handleStart);
bot.help(messageHandler.handleHelp);


bot.on(message('document'), (ctx) => documentHandler.handleDocument(ctx));
bot.on(message('text'), (ctx) => messageHandler.handleText(ctx));

bot.on("callback_query", async (ctx) => {
    if (!('data' in ctx.callbackQuery)) {
        await ctx.answerCbQuery("⚠️ Неверный формат запроса");
        return;
    }

    const data = ctx.callbackQuery.data;
    const sessionData = (ctx as any).sessionData;

    if (!sessionData) {
        return ctx.answerCbQuery("⚠️ Сессия устарела, загрузите JSON заново.");
    }

    const { json, diagnostics, unreachable, tempDir, sessionId } = sessionData;

    if (data === `report_excel_${sessionId}`) {
        const files = JSONProcessorObj.generateExcelReports(tempDir, diagnostics, unreachable, json);
        for (const [type, filepath] of Object.entries(files)) {
            await ctx.replyWithDocument({ source: filepath, filename: `${type}.xlsx` });
        }
        setTimeout(() => cleanupTempDir(tempDir), 30000);
    }

    if (data === `report_pdf_${sessionId}`) {
        const files = JSONProcessorObj.generatePDFReports(tempDir, diagnostics, unreachable);
        await ctx.replyWithDocument({ source: files.summary, filename: "report.pdf" });
        setTimeout(() => cleanupTempDir(tempDir), 30000);
    }

    await ctx.answerCbQuery(); // убираем "часики" в интерфейсе
});


// Обработчик ошибок
bot.catch(errorHandler.handleBotError);

export { bot };
