"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentHandler = exports.DocumentHandler = void 0;
const JSONProcessor_js_1 = require("../processors/JSONProcessor.js");
class DocumentHandler {
    async handleDocument(ctx) {
        try {
            const file = ctx.message.document;
            if (!file) {
                await ctx.reply("❌ Файл не найден");
                return;
            }
            // Проверка типа файла
            const isJSON = file.mime_type === "application/json" ||
                (file.file_name?.endsWith(".json") ?? false);
            if (!isJSON) {
                await ctx.reply("❌ Пожалуйста, отправьте файл с расширением .json");
                return;
            }
            // Обработка JSON файла
            await JSONProcessor_js_1.JSONProcessorObj.processJSON(ctx, file.file_id);
        }
        catch (error) {
            console.error("❌ Ошибка обработки документа:", error);
            await ctx.reply("⚠️ Произошла ошибка при обработке файла. Проверьте формат JSON и попробуйте снова.");
        }
    }
}
exports.DocumentHandler = DocumentHandler;
exports.documentHandler = new DocumentHandler();
