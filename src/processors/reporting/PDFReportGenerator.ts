import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { AnalysisResult, ReportFiles } from "../../types/json-processor.types";

const FONTS_PATH = path.join(process.cwd(), 'assets', 'fonts');

export class PDFReportGenerator {
    generateReports(result: AnalysisResult, dir: string): Promise<ReportFiles> {
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
                `Всего экранов: ${Object.keys(result.screens).length}`,
                `Проанализировано путей: ${result.paths.length}`,
                `Недостижимых экранов: ${result.unreachable.length}`,
                `Экраны с циклами: ${result.paths.filter((p) => p.status === "CYCLE").length}`,
                `Терминальные экраны: ${result.paths.filter((p) => p.status === "TERMINAL").length}`
            ]);
            doc.moveDown();

            if (result.unreachable.length > 0) {
                doc.fontSize(14).font('bold').text("Недостижимые экраны", { underline: true });
                doc.font('regular');
                result.unreachable.forEach((u) => {
                    doc.fontSize(12).text(`• ${u.screen} (${u.name || "Нет названия"})`);
                });
                doc.moveDown();
            }

            doc.fontSize(14).font('bold').text("Диагностика экранов", { underline: true });
            doc.font('regular');
            result.diagnostics.forEach((d) => {
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
