class MessageHandler {
    async handleStart(ctx) {
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

❓ Для справки используйте /help
    `;
        await ctx.reply(welcomeMessage);
    }
    async handleHelp(ctx) {
        const helpMessage = `
📖 Справка по использованию бота:

1. 📤 Отправьте JSON файл с структурой экранов
2. ⏳ Дождитесь анализа (может занять время для больших файлов)
3. 📥 Получите Excel отчеты с анализом

📊 Формируемые отчеты:
• diagnostics.xlsx - диагностика всех экранов
• paths.xlsx - все возможные пути навигации
• unreachable.xlsx - недостижимые экраны
• summary.xlsx - сводная статистика

⚠️ Ограничения:
• Максимальное количество анализируемых путей: 10,000
• Поддерживаются стандартные структуры JSON
    `;
        await ctx.reply(helpMessage);
    }
    async handleText(ctx) {
        await ctx.reply("📄 Пожалуйста, отправьте JSON файл для анализа");
    }
}
export default new MessageHandler();
