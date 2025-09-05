import path from "path";
import { Context } from "telegraf";
import {
	Diagnostic,
	JSONStructure,
	PathResult,
	ReportFiles,
	Screen
} from "../types/index.js";
const { cleanupTempFiles, createTempDir } = require("../utils/tempUtils.js");

var XLSX = require("xlsx");

class JSONProcessor {
	private screens: Record<string, Screen> = {};
	private edges: Record<string, (string | null)[]> = {};
	private paths: PathResult[] = [];
	private readonly MAX_PATHS = 10000;

	async processJSON(ctx: Context, fileId: string): Promise<void> {
		try {
			await ctx.reply("📊 Получен JSON. Начинаю анализ...");

			// Загружаем файл
			const fileLink = await ctx.telegram.getFileLink(fileId);
			const res = await fetch(fileLink.href);
			const text = await res.text();
			const json: JSONStructure = JSON.parse(text);

			// Анализ структуры
			this.analyzeStructure(json);

			const diagnostics = this.generateDiagnostics();
			const start = this.findStartScreen(json);

			if (start) {
				this.findPaths(start);
			} else {
				await ctx.reply("⚠️ Не удалось определить стартовый экран");
			}

			const unreachable = this.findUnreachableScreens();

			// Генерация отчетов
			const tempDir = createTempDir();
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
			setTimeout(() => cleanupTempFiles(), 30000);
		} catch (err) {
			console.error("❌ Ошибка обработки JSON:", err);
			throw new Error(
				`Ошибка при обработке JSON: ${err instanceof Error ? err.message : "Unknown error"
				}`
			);
		}
	}

	private analyzeStructure(json: JSONStructure): void {
		this.screens = {};
		(json.screens || []).forEach((s: Screen) => {
			this.screens[s.id] = s;
		});

		this.edges = {};

		const collectEdges = (
			rulesBlock: Record<string, any> | undefined
		): void => {
			if (!rulesBlock) return;

			for (const [screenId, rules] of Object.entries(rulesBlock)) {
				this.edges[screenId] = this.edges[screenId] || [];
				if (!Array.isArray(rules)) continue;

				for (const rule of rules) {
					let nexts: string[] = [];
					if (Array.isArray(rule.nextDisplay)) {
						nexts = rule.nextDisplay;
					} else if (typeof rule.nextDisplay === "string") {
						nexts = [rule.nextDisplay];
					}

					if (nexts.length === 0) {
						this.edges[screenId].push(null);
					} else {
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

	private generateDiagnostics(): Diagnostic[] {
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

	private findStartScreen(json: JSONStructure): string | null {
		if (json.init) return json.init;

		for (const [id, scr] of Object.entries(this.screens)) {
			if (scr.isFirstScreen) return id;
		}

		// Попробуем найти любой экран с входящими связями
		const allScreens = new Set(Object.keys(this.screens));
		const hasIncoming = new Set<string>();

		Object.values(this.edges).forEach((targets) => {
			targets.filter(Boolean).forEach((target) => {
				if (typeof target === "string") {
					hasIncoming.add(target);
				}
			});
		});

		const potentialStarts = Array.from(allScreens).filter(
			(screen) => !hasIncoming.has(screen)
		);

		return potentialStarts.length > 0 ? potentialStarts[0] : null;
	}

	private findPaths(start: string): void {
		const dfs = (cur: string, path: string[]): void => {
			if (this.paths.length >= this.MAX_PATHS) return;

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
				if (!n) continue;
				dfs(n, [...path, cur]);
			}
		};

		dfs(start, []);
	}

	private findUnreachableScreens(): Array<{ screen: string; name?: string }> {
		const reachable = new Set<string>();

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

	private generateReports(
		dir: string,
		diagnostics: Diagnostic[],
		unreachable: Array<{ screen: string; name?: string }>
	): ReportFiles {
		const files: Partial<ReportFiles> = {};

		try {
			// Диагностика экранов
			const ws1 = XLSX.utils.json_to_sheet(
				diagnostics.map((d) => ({
					"ID экрана": d.screen,
					Название: d.name || "Нет названия",
					Терминальный: d.terminal ? "Да" : "Нет",
					"Есть правила": d.has_rules ? "Да" : "Нет",
					"Исходящие связи": d.out_degree,
					"Всего правил": this.edges[d.screen]?.length || 0
				}))
			);

			const wb1 = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb1, ws1, "Диагностика");
			files.diagnostics = path.join(dir, "diagnostics.xlsx");
			XLSX.writeFile(wb1, files.diagnostics);

			// Пути
			const pathData = this.paths.map((p, index) => ({
				"№": index + 1,
				Длина: p.path.length,
				Статус:
					p.status === "CYCLE"
						? "ЦИКЛ"
						: p.status === "TERMINAL"
							? "ТЕРМИНАЛ"
							: "ТУПИК",
				Путь: p.path.join(" → "),
				Экраны: p.path.length
			}));

			const ws2 = XLSX.utils.json_to_sheet(pathData);
			const wb2 = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb2, ws2, "Пути");
			files.paths = path.join(dir, "paths.xlsx");
			XLSX.writeFile(wb2, files.paths);

			// Недостижимые экраны
			if (unreachable.length > 0) {
				const ws3 = XLSX.utils.json_to_sheet(
					unreachable.map((u) => ({
						"ID экрана": u.screen,
						Название: u.name || "Нет названия",
						Тип: this.screens[u.screen]?.isTerminal ? "Терминальный" : "Обычный"
					}))
				);

				const wb3 = XLSX.utils.book_new();
				XLSX.utils.book_append_sheet(wb3, ws3, "Недостижимые");
				files.unreachable = path.join(dir, "unreachable.xlsx");
				XLSX.writeFile(wb3, files.unreachable!);
			}

			// Сводный отчет
			const summaryData = [
				{
					"Всего экранов": Object.keys(this.screens).length,
					"Проанализировано путей": this.paths.length,
					"Недостижимых экранов": unreachable.length,
					"Экраны с циклами": this.paths.filter((p) => p.status === "CYCLE")
						.length,
					"Терминальные экраны": this.paths.filter(
						(p) => p.status === "TERMINAL"
					).length
				}
			];

			const ws4 = XLSX.utils.json_to_sheet(summaryData);
			const wb4 = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb4, ws4, "Сводка");
			files.summary = path.join(dir, "summary.xlsx");
			XLSX.writeFile(wb4, files.summary);
		} catch (error) {
			console.error("❌ Ошибка генерации отчетов:", error);
			throw error;
		}

		return files as ReportFiles;
	}
}

module.exports = new JSONProcessor();
