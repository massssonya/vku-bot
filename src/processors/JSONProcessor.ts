import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import {
	Diagnostic,
	JSONStructure,
	PathResult,
	ReportFiles,
	Screen
} from "../types/index.js";
import { createTempDir } from "../utils/temp-utils.js";

import XLSX from "xlsx";
import { CustomContext } from "../types/telegraf.js";
import SessionStorage from "../utils/session-storage.js";

const FONTS_PATH = path.join(process.cwd(), 'assets', 'fonts');

export class JSONProcessor {
	private screens: Record<string, Screen> = {};
	private edges: Record<string, (string | null)[]> = {};
	private paths: PathResult[] = [];
	private readonly MAX_PATHS = 10000;

	async processJSON(ctx: CustomContext, fileId: string): Promise<void> {
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
			let unreachable: Array<{ screen: string; name?: string }> = [];

			const start = this.findStartScreen(json);

			if (start) {
				this.findPaths(start);
				unreachable = this.findUnreachableScreens(start);
			} else {
				await ctx.reply("⚠️ Не удалось определить стартовый экран");
				unreachable = this.findUnreachableScreens();
			}

			// Проверка конфликтов условий
			const conditionConflicts = this.checkDuplicateConditions(json);
			if (conditionConflicts.length > 0) {
				await ctx.reply(`⚠️ Найдены конфликты условий (${conditionConflicts.length})`);
			}

			// Генерация отчетов
			const tempDir = createTempDir();
			const sessionId = SessionStorage.create({
				json,
				diagnostics,
				unreachable,
				tempDir
			});

			await ctx.reply("📑 В каком формате сформировать отчёты?", {
				reply_markup: {
					inline_keyboard: [
						[{ text: "📊 Excel", callback_data: `report_excel_${sessionId}` }],
						[{ text: "📄 PDF", callback_data: `report_pdf_${sessionId}` }]
					]
				}
			})
			// const files = this.generateReports(tempDir, diagnostics, unreachable, json);

			// await ctx.reply("✅ Анализ завершён. Формирую отчеты...");

			// // Отправка файлов пользователю
			// for (const [type, filepath] of Object.entries(files)) {
			// 	await ctx.replyWithDocument({
			// 		source: filepath,
			// 		filename: `${type}_report.xlsx`
			// 	});
			// }

			// Очистка временных файлов
			// setTimeout(() => cleanupTempDir(tempDir), 30000);
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
		// Диагностика: сколько экранов в this.screens и примеры
		console.log("DEBUG: this.screens count =", Object.keys(this.screens).length);
		console.log("DEBUG: this.screens keys sample:", Object.keys(this.screens).slice(0, 10));
		console.log("DEBUG: first few screens with isFirstScreen:",
			Object.entries(this.screens)
				.filter(([, s]) => !!s && ("isFirstScreen" in s))
				.slice(0, 10)
				.map(([id, s]) => ({ id, isFirstScreen: (s as any).isFirstScreen }))
		);

		// 1) json.init (только если совпадает с имеющимися id)
		if (json.init) {
			if (this.screens[json.init]) {
				console.log("DEBUG: using json.init ->", json.init);
				return json.init;
			} else {
				console.warn("WARN: json.init present but not found in this.screens:", json.init);
			}
		}

		// 2) Поиск по this.screens: учитываем любые truthy значения (boolean/string/number)
		for (const [id, scr] of Object.entries(this.screens)) {
			if (scr && (scr as any).isFirstScreen) {
				console.log("DEBUG: found isFirstScreen in this.screens ->", id);
				return id;
			}
		}

		// 3) Фallback — поиск напрямую в json.screens (на случай, если analyzeStructure не сработал)
		if (Array.isArray(json.screens) && json.screens.length > 0) {
			const direct = (json.screens || []).find((s) => s && s.isFirstScreen);
			if (direct) {
				console.log("DEBUG: found isFirstScreen directly in json.screens ->", direct.id);
				return direct.id;
			}
		}

		// 4) Fallback — экран без входящих связей
		const allScreens = new Set(Object.keys(this.screens));
		const hasIncoming = new Set<string>();

		Object.values(this.edges).forEach((targets) => {
			if (!Array.isArray(targets)) return;
			targets.forEach((t) => {
				if (t && typeof t === "string") hasIncoming.add(t);
			});
		});

		const potentialStarts = Array.from(allScreens).filter((s) => !hasIncoming.has(s));
		if (potentialStarts.length > 0) {
			console.log("DEBUG: using potential start (no incoming) ->", potentialStarts[0], "candidates:", potentialStarts.slice(0, 5));
			return potentialStarts[0];
		}

		console.warn("WARN: start screen not found by any method");
		return null;
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

	private findUnreachableScreens(start?: string): Array<{ screen: string; name?: string }> {
		const reachable = new Set<string>();

		// Если есть стартовый экран — обходим граф от него
		if (start) {
			const dfs = (cur: string) => {
				if (reachable.has(cur)) return;
				reachable.add(cur);

				const nexts = this.edges[cur] || [];
				nexts.forEach((n) => {
					if (n) dfs(n);
				});
			};
			dfs(start);
		} else {
			console.warn("⚠️ Стартовый экран не найден. Все экраны считаются недостижимыми.");
		}

		// Всё, что не попало в reachable → недостижимое
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

	// ======================= Генерация Excel =======================
	generateExcelReports(
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

	// ======================= Генерация PDF =======================

	generatePDFReports(
		dir: string,
		diagnostics: Diagnostic[],
		unreachable: Array<{ screen: string; name?: string }>
	): Promise<ReportFiles> {
		return new Promise((resolve, reject) => {
			const files: Partial<ReportFiles> = {};
			const pdfPath = path.join(dir, "report.pdf");

			const doc = new PDFDocument();
			const stream = fs.createWriteStream(pdfPath);

			doc.pipe(stream);

			doc.registerFont('regular', path.join(FONTS_PATH, 'Roboto-Regular.ttf'));
			doc.registerFont('bold', path.join(FONTS_PATH, 'Roboto-Bold.ttf'));

			doc.font('regular');

			doc.fontSize(18).font('bold').text("Диагностика экранов", { align: "center" });
			doc.moveDown();



			doc.fontSize(14).font('bold').text("Сводка", { underline: true });

			doc.font('regular');
			doc.fontSize(12).list([
				`Всего экранов: ${Object.keys(this.screens).length}`,
				`Проанализировано путей: ${this.paths.length}`,
				`Недостижимых экранов: ${unreachable.length}`,
				`Экраны с циклами: ${this.paths.filter((p) => p.status === "CYCLE").length}`,
				`Терминальные экраны: ${this.paths.filter((p) => p.status === "TERMINAL").length}`
			]);
			doc.moveDown();

			if (unreachable.length > 0) {
				doc.fontSize(14).font('bold').text("Недостижимые экраны", { underline: true });
				doc.font('regular');
				unreachable.forEach((u) => {
					doc.fontSize(12).text(`• ${u.screen} (${u.name || "Нет названия"})`);
				});
				doc.moveDown();
			}

			doc.fontSize(14).font('bold').text("Диагностика экранов", { underline: true });
			doc.font('regular');
			diagnostics.forEach((d) => {
				doc.fontSize(10).text(
					`ID: ${d.screen}, Название: ${d.name || "—"}, Терминальный: ${d.terminal ? "Да" : "Нет"}, Правила: ${d.has_rules ? "Да" : "Нет"}, Исходящие связи: ${d.out_degree}`
				);
			});

			stream.on('finish', () => {
				files.summary = pdfPath;
				resolve(files as ReportFiles);
			});

			stream.on('error', reject);

			doc.end();
		}
		)
	}
}

export const JSONProcessorObj = new JSONProcessor();
