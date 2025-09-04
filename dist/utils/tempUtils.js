"use strict";
const fs = require('fs');
const os = require('os');
const path = require('path');
const TEMP_DIR_PREFIX = 'tgjson-';
function createTempDir() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
    console.log(`📁 Создана временная директория: ${tempDir}`);
    return tempDir;
}
function cleanupTempFiles() {
    console.log('🧹 Запускаю очистку временных файлов...');
    const tempDir = os.tmpdir();
    try {
        const files = fs.readdirSync(tempDir);
        files.forEach((file) => {
            if (file.startsWith(TEMP_DIR_PREFIX)) {
                const dirPath = path.join(tempDir, file);
                try {
                    fs.rmSync(dirPath, { recursive: true, force: true });
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
module.exports = {
    createTempDir,
    cleanupTempFiles,
};
