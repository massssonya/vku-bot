"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONProcessorObj = exports.JSONProcessor = void 0;
const path_1 = __importDefault(require("path"));
const tempUtils_js_1 = require("../utils/tempUtils.js");
const xlsx_1 = __importDefault(require("xlsx"));
class JSONProcessor {
    screens = {};
    edges = {};
    paths = [];
    MAX_PATHS = 10000;
    async processJSON(ctx, fileId) {
        try {
            await ctx.reply("📊 Получен JSON. Начинаю анализ...");
            // Загружаем файл
            const fileLink = await ctx.telegram.getFileLink(fileId);
            const res = await fetch(fileLink.href);
            const text = await res.text();
            const json = JSON.parse(text);
            // Анализ структуры
            this.analyzeStructure(json);
            const diagnostics = this.generateDiagnostics();
            const start = this.findStartScreen(json);
            if (start) {
                this.findPaths(start);
            }
            else {
                await ctx.reply("⚠️ Не удалось определить стартовый экран");
            }
            const unreachable = this.findUnreachableScreens();
            // Генерация отчетов
            const tempDir = (0, tempUtils_js_1.createTempDir)();
            const files = this.generateReports(tempDir, diagnostics, unreachable);
            await ctx.reply("✅ Анализ завершён. Формирую отчеты...");
            // Отправка файлов пользователю
            for (const [type, filepath] of Object.entries(files)) {
                await ctx.replyWithDocument({
                    source: filepath,
                    filename: `${type}_report.xlsx`
                });
            }
            // Очистка временных файлов
            setTimeout(() => (0, tempUtils_js_1.cleanupTempFiles)(), 30000);
        }
        catch (err) {
            console.error("❌ Ошибка обработки JSON:", err);
            throw new Error(`Ошибка при обработке JSON: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
    }
    analyzeStructure(json) {
        this.screens = {};
        (json.screens || []).forEach((s) => {
            this.screens[s.id] = s;
        });
        this.edges = {};
        const collectEdges = (rulesBlock) => {
            if (!rulesBlock)
                return;
            for (const [screenId, rules] of Object.entries(rulesBlock)) {
                this.edges[screenId] = this.edges[screenId] || [];
                if (!Array.isArray(rules))
                    continue;
                for (const rule of rules) {
                    let nexts = [];
                    if (Array.isArray(rule.nextDisplay)) {
                        nexts = rule.nextDisplay;
                    }
                    else if (typeof rule.nextDisplay === "string") {
                        nexts = [rule.nextDisplay];
                    }
                    if (nexts.length === 0) {
                        this.edges[screenId].push(null);
                    }
                    else {
                        for (const n of nexts) {
                            this.edges[screenId].push(n);
                        }
                    }
                }
            }
        };
        collectEdges(json.screenRules);
        collectEdges(json.cycledScreenRules);
    }
    generateDiagnostics() {
        return Object.entries(this.screens).map(([id, scr]) => {
            const rules = this.edges[id] || [];
            const terminal = !!scr.isTerminal;
            return {
                screen: id,
                name: scr.name,
                terminal,
                has_rules: rules.length > 0,
                out_degree: rules.filter(Boolean).length
            };
        });
    }
    findStartScreen(json) {
        if (json.init)
            return json.init;
        for (const [id, scr] of Object.entries(this.screens)) {
            if (scr.isFirstScreen)
                return id;
        }
        // Попробуем найти любой экран с входящими связями
        const allScreens = new Set(Object.keys(this.screens));
        const hasIncoming = new Set();
        Object.values(this.edges).forEach((targets) => {
            targets.filter(Boolean).forEach((target) => {
                if (typeof target === "string") {
                    hasIncoming.add(target);
                }
            });
        });
        const potentialStarts = Array.from(allScreens).filter((screen) => !hasIncoming.has(screen));
        return potentialStarts.length > 0 ? potentialStarts[0] : null;
    }
    findPaths(start) {
        const dfs = (cur, path) => {
            if (this.paths.length >= this.MAX_PATHS)
                return;
            if (path.includes(cur)) {
                this.paths.push({
                    path: [...path, cur],
                    status: "CYCLE"
                });
                return;
            }
            const nexts = this.edges[cur] || [];
            if (!nexts.length) {
                const term = this.screens[cur]?.isTerminal;
                this.paths.push({
                    path: [...path, cur],
                    status: term ? "TERMINAL" : "DEAD_END"
                });
                return;
            }
            for (const n of nexts) {
                if (!n)
                    continue;
                dfs(n, [...path, cur]);
            }
        };
        dfs(start, []);
    }
    findUnreachableScreens() {
        const reachable = new Set();
        this.paths.forEach((p) => {
            p.path.forEach((s) => reachable.add(s));
        });
        return Object.keys(this.screens)
            .filter((id) => !reachable.has(id))
            .map((id) => ({
            screen: id,
            name: this.screens[id]?.name
        }));
    }
    generateReports(dir, diagnostics, unreachable) {
        const files = {};
        try {
            // Диагностика экранов
            const ws1 = xlsx_1.default.utils.json_to_sheet(diagnostics.map((d) => ({
                "ID экрана": d.screen,
                Название: d.name || "Нет названия",
                Терминальный: d.terminal ? "Да" : "Нет",
                "Есть правила": d.has_rules ? "Да" : "Нет",
                "Исходящие связи": d.out_degree,
                "Всего правил": this.edges[d.screen]?.length || 0
            })));
            const wb1 = xlsx_1.default.utils.book_new();
            xlsx_1.default.utils.book_append_sheet(wb1, ws1, "Диагностика");
            files.diagnostics = path_1.default.join(dir, "diagnostics.xlsx");
            xlsx_1.default.writeFile(wb1, files.diagnostics);
            // Пути
            const pathData = this.paths.map((p, index) => ({
                "№": index + 1,
                Длина: p.path.length,
                Статус: p.status === "CYCLE"
                    ? "ЦИКЛ"
                    : p.status === "TERMINAL"
                        ? "ТЕРМИНАЛ"
                        : "ТУПИК",
                Путь: p.path.join(" → "),
                Экраны: p.path.length
            }));
            const ws2 = xlsx_1.default.utils.json_to_sheet(pathData);
            const wb2 = xlsx_1.default.utils.book_new();
            xlsx_1.default.utils.book_append_sheet(wb2, ws2, "Пути");
            files.paths = path_1.default.join(dir, "paths.xlsx");
            xlsx_1.default.writeFile(wb2, files.paths);
            // Недостижимые экраны
            if (unreachable.length > 0) {
                const ws3 = xlsx_1.default.utils.json_to_sheet(unreachable.map((u) => ({
                    "ID экрана": u.screen,
                    Название: u.name || "Нет названия",
                    Тип: this.screens[u.screen]?.isTerminal ? "Терминальный" : "Обычный"
                })));
                const wb3 = xlsx_1.default.utils.book_new();
                xlsx_1.default.utils.book_append_sheet(wb3, ws3, "Недостижимые");
                files.unreachable = path_1.default.join(dir, "unreachable.xlsx");
                xlsx_1.default.writeFile(wb3, files.unreachable);
            }
            // Сводный отчет
            const summaryData = [
                {
                    "Всего экранов": Object.keys(this.screens).length,
                    "Проанализировано путей": this.paths.length,
                    "Недостижимых экранов": unreachable.length,
                    "Экраны с циклами": this.paths.filter((p) => p.status === "CYCLE")
                        .length,
                    "Терминальные экраны": this.paths.filter((p) => p.status === "TERMINAL").length
                }
            ];
            const ws4 = xlsx_1.default.utils.json_to_sheet(summaryData);
            const wb4 = xlsx_1.default.utils.book_new();
            xlsx_1.default.utils.book_append_sheet(wb4, ws4, "Сводка");
            files.summary = path_1.default.join(dir, "summary.xlsx");
            xlsx_1.default.writeFile(wb4, files.summary);
        }
        catch (error) {
            console.error("❌ Ошибка генерации отчетов:", error);
            throw error;
        }
        return files;
    }
}
exports.JSONProcessor = JSONProcessor;
exports.JSONProcessorObj = new JSONProcessor();
