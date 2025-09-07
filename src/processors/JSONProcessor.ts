import path from "path";
import { Context } from "telegraf";
import {
	Diagnostic,
	JSONStructure,
	PathResult,
	ReportFiles,
	Screen
} from "../types/index.js";
import { cleanupTempFiles, createTempDir } from "../utils/tempUtils.js";

import XLSX from "xlsx";

export class JSONProcessor {
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

			// Проверка конфликтов условий
			const conditionConflicts = this.checkDuplicateConditions(json);
			if (conditionConflicts.length > 0) {
				await ctx.reply(`⚠️ Найдены конфликты условий (${conditionConflicts.length})`);
			}

			// Генерация отчетов
			const tempDir = createTempDir();
			const files = this.generateReports(tempDir, diagnostics, unreachable, json);

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
				`Ошибка при обработке JSON: ${err instanceof Error ? err.message : "Unknown error"}`
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

		// Попробуем найти любой экран без входящих связей
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

	// 🔍 Проверка на конфликты условий
	private checkDuplicateConditions(json: JSONStructure) {
		const problems: Array<{
			screenId: string;
			condition: string;
			nextDisplays: string[];
		}> = [];

		const checkRulesBlock = (rulesBlock: Record<string, any> | undefined) => {
			if (!rulesBlock) return;

			for (const [screenId, rules] of Object.entries(rulesBlock)) {
				if (!Array.isArray(rules)) continue;

				const conditionMap: Record<string, Set<string>> = {};

				for (const rule of rules) {
					const conds = JSON.stringify(rule.conditions ?? []);
					const nexts = Array.isArray(rule.nextDisplay)
						? rule.nextDisplay
						: rule.nextDisplay
							? [rule.nextDisplay]
							: [];

					if (!conditionMap[conds]) {
						conditionMap[conds] = new Set();
					}

					nexts.forEach((n: string) => conditionMap[conds].add(n || "null"));
				}

				for (const [conds, nextSet] of Object.entries(conditionMap)) {
					if (nextSet.size > 1) {
						problems.push({
							screenId,
							condition: conds,
							nextDisplays: Array.from(nextSet)
						});
					}
				}
			}
		};

		checkRulesBlock(json.screenRules);
		checkRulesBlock(json.cycledScreenRules);

		return problems;
	}

	private normalizeCondition(c: any): string {
		if (c.protectedField) {
			// Сложное условие
			return JSON.stringify({
				field: c.protectedField,
				predicate: c.predicate,
				value: c.value,
				args: c.args
			});
		} else {
			// Простое условие (всегда равенство)
			return JSON.stringify({
				field: c.field,
				predicate: "equals",
				value: c.value
			});
		}
	}

	private normalizeConditionsArray(conds: any[]): string[] {
		return conds.map(c => this.normalizeCondition(c)).sort();
	}

	private isSubset(condsA: any[], condsB: any[]): boolean {
		const normA = this.normalizeConditionsArray(condsA);
		const normB = this.normalizeConditionsArray(condsB);
		return normA.every(c => normB.includes(c));
	}

	private checkContradictoryConditions(json: JSONStructure) {
		const problems: Array<{
			screenId: string;
			condsA: any[];
			nextA: any;
			condsB: any[];
			nextB: any;
			reason: string;
		}> = [];

		const checkRulesBlock = (rulesBlock: Record<string, any> | undefined) => {
			if (!rulesBlock) return;

			for (const [screenId, rules] of Object.entries(rulesBlock)) {
				if (!Array.isArray(rules)) continue;

				for (let i = 0; i < rules.length; i++) {
					for (let j = i + 1; j < rules.length; j++) {
						const r1 = rules[i];
						const r2 = rules[j];

						const conds1 = r1.conditions ?? [];
						const conds2 = r2.conditions ?? [];

						const norm1 = this.normalizeConditionsArray(conds1);
						const norm2 = this.normalizeConditionsArray(conds2);

						const sameConditions = JSON.stringify(norm1) === JSON.stringify(norm2);
						const subset1 = this.isSubset(conds1, conds2);
						const subset2 = this.isSubset(conds2, conds1);

						if ((sameConditions || subset1 || subset2) &&
							JSON.stringify(r1.nextDisplay) !== JSON.stringify(r2.nextDisplay)) {
							problems.push({
								screenId,
								condsA: conds1,
								nextA: r1.nextDisplay,
								condsB: conds2,
								nextB: r2.nextDisplay,
								reason: sameConditions
									? "Одинаковые условия ведут к разным экранам"
									: "Вложенные условия ведут к разным экранам"
							});
						}
					}
				}
			}
		};

		checkRulesBlock(json.screenRules);
		checkRulesBlock(json.cycledScreenRules);

		return problems;
	}


	private generateReports(
		dir: string,
		diagnostics: Diagnostic[],
		unreachable: Array<{ screen: string; name?: string }>,
		json: JSONStructure
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
					"Экраны с циклами": this.paths.filter((p) => p.status === "CYCLE").length,
					"Терминальные экраны": this.paths.filter((p) => p.status === "TERMINAL").length
				}
			];

			const ws4 = XLSX.utils.json_to_sheet(summaryData);
			const wb4 = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb4, ws4, "Сводка");
			files.summary = path.join(dir, "summary.xlsx");
			XLSX.writeFile(wb4, files.summary);

			// Конфликты условий
			const conditionConflicts = this.checkDuplicateConditions(json);
			if (conditionConflicts.length > 0) {
				const ws5 = XLSX.utils.json_to_sheet(
					conditionConflicts.map((c) => ({
						"ID экрана": c.screenId,
						"Условия": c.condition,
						"Переходы": c.nextDisplays.join(", ")
					}))
				);

				const wb5 = XLSX.utils.book_new();
				XLSX.utils.book_append_sheet(wb5, ws5, "Конфликты условий");
				files.conflicts = path.join(dir, "conflicts.xlsx");
				XLSX.writeFile(wb5, files.conflicts);
			}

			// Противоречивые условия
			const contradictions = this.checkContradictoryConditions(json);
			if (contradictions.length > 0) {
				const ws6 = XLSX.utils.json_to_sheet(
					contradictions.map((c) => ({
						"ID экрана": c.screenId,
						"Условия A": JSON.stringify(c.condsA),
						"Переход A": JSON.stringify(c.nextA),
						"Условия B": JSON.stringify(c.condsB),
						"Переход B": JSON.stringify(c.nextB),
						"Причина": c.reason
					}))
				);

				const wb6 = XLSX.utils.book_new();
				XLSX.utils.book_append_sheet(wb6, ws6, "Противоречия");
				files.contradictions = path.join(dir, "contradictions.xlsx");
				XLSX.writeFile(wb6, files.contradictions);
			}

		} catch (error) {
			console.error("❌ Ошибка генерации отчетов:", error);
			throw error;
		}

		return files as ReportFiles;
	}
}

export const JSONProcessorObj = new JSONProcessor();
