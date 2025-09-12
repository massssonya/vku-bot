import XLSX from "xlsx";
import path from "path";
import { AnalysisResult, JSONStructure, ReportFiles } from "../../types/json-processor.types";


export class ExcelReportGenerator {
    generateReports(
        result: AnalysisResult,
        json: JSONStructure,
        dir: string
    ): ReportFiles {
        const files: Partial<ReportFiles> = {};

        try {
            // Диагностика экранов
            const ws1 = XLSX.utils.json_to_sheet(
                result.diagnostics.map((d) => ({
                    "ID экрана": d.screen,
                    Название: d.name || "Нет названия",
                    Терминальный: d.terminal ? "Да" : "Нет",
                    "Есть правила": d.has_rules ? "Да" : "Нет",
                    "Исходящие связи": d.out_degree,
                    "Всего правил": result.edges[d.screen]?.length || 0
                }))
            );

            const wb1 = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb1, ws1, "Диагностика");
            files.diagnostics = path.join(dir, "diagnostics.xlsx");
            XLSX.writeFile(wb1, files.diagnostics);

            // Пути
            const pathData = result.paths.map((p, index) => ({
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
            if (result.unreachable.length > 0) {
                const ws3 = XLSX.utils.json_to_sheet(
                    result.unreachable.map((u) => ({
                        "ID экрана": u.screen,
                        Название: u.name || "Нет названия",
                        Тип: result.screens[u.screen].isTerminal ? "Терминальный" : "Обычный"
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
                    "Всего экранов": Object.keys(result.screens).length,
                    "Проанализировано путей": result.paths.length,
                    "Недостижимых экранов": result.unreachable.length,
                    "Экраны с циклами": result.paths.filter((p) => p.status === "CYCLE").length,
                    "Терминальные экраны": result.paths.filter((p) => p.status === "TERMINAL").length
                }
            ];

            const ws4 = XLSX.utils.json_to_sheet(summaryData);
            const wb4 = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb4, ws4, "Сводка");
            files.summary = path.join(dir, "summary.xlsx");
            XLSX.writeFile(wb4, files.summary);

            // Конфликты условий
            const conditionConflicts = result.conflicts;
            
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
            const contradictions = result.contradictions;
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