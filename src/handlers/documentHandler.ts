import { DocumentContext } from "../types/json-processor.types.js";
import { JSONProcessor } from "../processors/JSONProcessor.js";
import { createTempDir } from "../utils/temp-utils.js";
import SessionStorage from "../utils/session-storage.js";

export class DocumentHandler {
	async handleDocument(ctx: DocumentContext, processor: JSONProcessor): Promise<void> {

		try {
			const file = ctx.message.document;
			if (!file) {
				await ctx.reply("❌ Файл не найден");
				return;
			}

			// Проверка типа файла
			const isJSON =
				file.mime_type === "application/json" ||
				(file.file_name?.endsWith(".json") ?? false);

			if (!isJSON) {
				await ctx.reply(
					"❌ Пожалуйста, отправьте файл с расширением .json"
				);
				return;
			}

			const fileLink = await ctx.telegram.getFileLink(file.file_id);
			const res = await fetch(fileLink.href);
			const json = await res.json();

			await ctx.reply("📊 Получен JSON. Начинаю анализ...");

			// Обработка JSON файла
			const result = await processor.analyze(json);

			const tempDir = createTempDir();
			const sessionId = SessionStorage.create({
				chatId: ctx.chat.id,
				analysisResult: result,
				tempDir,
				json
			});
			await ctx.reply("📑 В каком формате сформировать отчёты?",
				{
					reply_markup: {
						inline_keyboard: [
							[{ text: "📊 Excel", callback_data: `report_excel_${sessionId}` }],
							[{ text: "📄 PDF", callback_data: `report_pdf_${sessionId}` }],
						],
					},
				}
			)

		} catch (error) {
			console.error("❌ Ошибка обработки документа:", error);
			await ctx.reply(
				"⚠️ Произошла ошибка при обработке файла. Проверьте формат JSON и попробуйте снова."
			);
		}
	}
}

export const documentHandler = new DocumentHandler();