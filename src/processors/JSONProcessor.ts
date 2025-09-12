import {
	AnalysisResult,
	JSONStructure,
} from "../types/json-processor.types.js";

import { Analyzer } from "./analysis/Analyzer.js";
import { ScreenGraphBuilder } from "./graph/ScreenGraphBuilder.js";
import { PathFinder } from "./graph/PathFinder.js";
import { ConditionValidator } from "./conditions/ConditionValidator.js";
import { ExcelReportGenerator } from "./reporting/ExcelReportGenerator.js";
import { PDFReportGenerator } from "./reporting/PDFReportGenerator.js";



export class JSONProcessor {
	private graphBuilder = new ScreenGraphBuilder()
	private pathFinder = new PathFinder()
	private analyzer = new Analyzer()
	private conditionValidator = new ConditionValidator()
	private excelGen = new ExcelReportGenerator()
	private pdfGen = new PDFReportGenerator()

	analyze(json: JSONStructure):AnalysisResult {
		const {edges, screens} = this.graphBuilder.build(json)
		const start = this.graphBuilder.findStart(json, screens, edges)
		const paths = start ? this.pathFinder.findPaths(start, edges, screens):[]
		const diagnostics = this.analyzer.generateDiagnostics(screens, edges)
		const unreachable = this.analyzer.findUnreachableScreens(screens, edges, start)
		const conflicts = this.conditionValidator.checkDuplicateConditions(json)
		const contradictions = this.conditionValidator.checkContradictoryConditions(json)

		return { diagnostics, paths, unreachable, conflicts, contradictions, edges, screens };
	}

	generateExcel(result:AnalysisResult, json:JSONStructure, dir: string){
		return this.excelGen.generateReports(result, json, dir)
	}

	generatePDF(result:AnalysisResult, dir: string){
		return this.pdfGen.generateReports(result, dir)
	}

	// ======================= Генерация PDF =======================

	// generatePDFReports(
	// 	dir: string,
	// 	diagnostics: Diagnostic[],
	// 	unreachable: Array<{ screen: string; name?: string }>,
	// 	paths: PathResult[]
	// ): Promise<ReportFiles> {
	// 	return new Promise((resolve, reject) => {
	// 		const files: Partial<ReportFiles> = {};
	// 		const pdfPath = path.join(dir, "report.pdf");

	// 		const doc = new PDFDocument();
	// 		const stream = fs.createWriteStream(pdfPath);

	// 		doc.pipe(stream);

	// 		doc.registerFont('regular', path.join(FONTS_PATH, 'Roboto-Regular.ttf'));
	// 		doc.registerFont('bold', path.join(FONTS_PATH, 'Roboto-Bold.ttf'));

	// 		doc.font('regular');

	// 		doc.fontSize(18).font('bold').text("Диагностика экранов", { align: "center" });
	// 		doc.moveDown();



	// 		doc.fontSize(14).font('bold').text("Сводка", { underline: true });

	// 		doc.font('regular');
	// 		doc.fontSize(12).list([
	// 			`Всего экранов: ${Object.keys(this.screens).length}`,
	// 			`Проанализировано путей: ${paths.length}`,
	// 			`Недостижимых экранов: ${unreachable.length}`,
	// 			`Экраны с циклами: ${paths.filter((p) => p.status === "CYCLE").length}`,
	// 			`Терминальные экраны: ${paths.filter((p) => p.status === "TERMINAL").length}`
	// 		]);
	// 		doc.moveDown();

	// 		if (unreachable.length > 0) {
	// 			doc.fontSize(14).font('bold').text("Недостижимые экраны", { underline: true });
	// 			doc.font('regular');
	// 			unreachable.forEach((u) => {
	// 				doc.fontSize(12).text(`• ${u.screen} (${u.name || "Нет названия"})`);
	// 			});
	// 			doc.moveDown();
	// 		}

	// 		doc.fontSize(14).font('bold').text("Диагностика экранов", { underline: true });
	// 		doc.font('regular');
	// 		diagnostics.forEach((d) => {
	// 			doc.fontSize(10).text(
	// 				`ID: ${d.screen}, Название: ${d.name || "—"}, Терминальный: ${d.terminal ? "Да" : "Нет"}, Правила: ${d.has_rules ? "Да" : "Нет"}, Исходящие связи: ${d.out_degree}`
	// 			);
	// 		});

	// 		stream.on('finish', () => {
	// 			files.summary = pdfPath;
	// 			resolve(files as ReportFiles);
	// 		});

	// 		stream.on('error', reject);

	// 		doc.end();
	// 	}
	// 	)
	// }
}
