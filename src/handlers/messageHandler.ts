import { Context } from "telegraf";
import SessionStorage from "../utils/session-storage";
import { JsonLogicConverterObj } from "../converters/JsonLogicConverter";

class MessageHandler {
	async handleStart(ctx: Context): Promise<void> {
		const welcomeMessage = `
	  🤖 Добро пожаловать в VKU Analyzer Bot!
	  
	  📊 Я анализирую JSON файлы со структурой экранов и правил навигации.
	  
	  📁 Отправьте мне JSON файл, и я предоставлю:
	  • Диагностику всех экранов
	  • Анализ путей навигации
	  • Выявление недостижимых экранов
	  • Общую статистику
	  
	  📋 Пример ожидаемой структуры:
	  {
		"screens": [...],
		"screenRules": {...},
		"cycledScreenRules": {...}
	  }
	  
	  ⚙️ Дополнительно:
	  • Используйте команду /jsonlogic чтобы преобразовать условие в JsonLogic формат
		(например: \`(answer.q_represent.value == Глава1) and (answer.q_represent.value == Глава2) => Ответ1;\`)
	  
	  ❓ Для справки используйте /help
		`;

		await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
	}

	async handleHelp(ctx: Context): Promise<void> {
		const helpMessage = `
	  📖 Справка по использованию бота:
	  
	  1. 📤 Отправьте JSON файл со структурой экранов
	  2. ⏳ Дождитесь анализа (может занять время для больших файлов)
	  3. 📥 Получите Excel отчеты с анализом
	  
	  📊 Формируемые отчеты:
	  • diagnostics.xlsx - диагностика всех экранов
	  • paths.xlsx - все возможные пути навигации
	  • unreachable.xlsx - недостижимые экраны
	  • summary.xlsx - сводная статистика
	  • conflicts.xlsx - проверка на дублирующиеся условия 
	  • contradictions.xlsx - проверка на противоречивые условия
	  
	  ⚙️ Дополнительные возможности:
	  • /jsonlogic — преобразование условий в формат JsonLogic  
		 Пример ввода:  
		 \`\`\`
		 (answer.q_represent.value == Глава1) and (answer.q_represent.value == Глава2) => Ответ1;
		 answer.q_represent.value == Глава4 => Ответ2
		 \`\`\`
		 Результат вернётся в JsonLogic формате.
	  
	  ⚠️ Ограничения:
	  • Максимальное количество анализируемых путей: 10,000
	  • Поддерживаются стандартные структуры JSON
		`;

		await ctx.reply(helpMessage, { parse_mode: "Markdown" });
	}

	async handleText(ctx: Context): Promise<void> {

		const chatId = ctx.chat?.id!;
		const session = SessionStorage.getByChatId(chatId);
		const userInput = ctx.text;

		// Если ждём ввод для JsonLogic
		if (session?.awaitingJsonLogic && userInput) {
			try {
				const result = JsonLogicConverterObj.toJsonLogic(userInput);

				await ctx.reply("✅ Ваш JsonLogic:");
				await ctx.reply("```\n" + result + "\n```", {
					parse_mode: "MarkdownV2",
				});

				// Сброс состояния
				session.awaitingJsonLogic = false;
			} catch (error: any) {
				await ctx.reply("⚠ Ошибка: " + error.message);
			}
			return;
		}

		// Поведение по умолчанию
		await ctx.reply("📄 Пожалуйста, отправьте JSON файл для анализа");
	}
}

export const messageHandler = new MessageHandler()