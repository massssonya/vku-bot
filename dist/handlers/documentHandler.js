import JSONProcessor from "../processors/JSONProcessor.js";
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
            await JSONProcessor.processJSON(ctx, file.file_id);
        }
        catch (error) {
            console.error("❌ Ошибка обработки документа:", error);
            await ctx.reply("⚠️ Произошла ошибка при обработке файла. Проверьте формат JSON и попробуйте снова.");
        }
    }
}
export default new DocumentHandler();
