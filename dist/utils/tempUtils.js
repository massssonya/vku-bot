import fs from 'fs';
import os from 'os';
import path from 'path';
const TEMP_DIR = './temp';
export function createTempDir() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgjson-'));
    console.log(`📁 Создана временная директория: ${tempDir}`);
    return tempDir;
}
export function cleanupTempFiles() {
    try {
        if (fs.existsSync(TEMP_DIR)) {
            fs.rmSync(TEMP_DIR, { recursive: true, force: true });
            console.log('🧹 Временные файлы очищены');
        }
    }
    catch (error) {
        console.error('❌ Ошибка очистки временных файлов:', error);
    }
}
export function ensureTempDir() {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    return TEMP_DIR;
}
