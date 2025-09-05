"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTempDir = createTempDir;
exports.cleanupTempFiles = cleanupTempFiles;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const TEMP_DIR_PREFIX = 'tgjson-';
function createTempDir() {
    const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), TEMP_DIR_PREFIX));
    console.log(`📁 Создана временная директория: ${tempDir}`);
    return tempDir;
}
function cleanupTempFiles() {
    console.log('🧹 Запускаю очистку временных файлов...');
    const tempDir = os_1.default.tmpdir();
    try {
        const files = fs_1.default.readdirSync(tempDir);
        files.forEach((file) => {
            if (file.startsWith(TEMP_DIR_PREFIX)) {
                const dirPath = path_1.default.join(tempDir, file);
                try {
                    fs_1.default.rmSync(dirPath, { recursive: true, force: true });
                    console.log(`🗑️  Удалена директория: ${dirPath}`);
                }
                catch (e) {
                    console.error(`❌ Не удалось удалить директорию ${dirPath}:`, e);
                }
            }
        });
        console.log('✅ Очистка завершена.');
    }
    catch (error) {
        console.error('❌ Ошибка при чтении временной директории:', error);
    }
}
// module.exports = {
//   createTempDir,
//   cleanupTempFiles,
// };
