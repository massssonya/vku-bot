import fs from 'fs';
import os from 'os';
import path from 'path';

const TEMP_DIR_PREFIX = 'tgjson-';

export function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
  console.log(`📁 Создана временная директория: ${tempDir}`);
  return tempDir;
}

export function cleanupTempFiles() {
  console.log('🧹 Запускаю очистку временных файлов...');
  const tempDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tempDir);
    files.forEach((file: string) => {
      if (file.startsWith(TEMP_DIR_PREFIX)) {
        const dirPath = path.join(tempDir, file);
        try {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`🗑️  Удалена директория: ${dirPath}`);
        } catch (e) {
          console.error(`❌ Не удалось удалить директорию ${dirPath}:`, e);
        }
      }
    });
    console.log('✅ Очистка завершена.');

  } catch (error) {
    console.error('❌ Ошибка при чтении временной директории:', error);
  }
}

// module.exports = {
//   createTempDir,
//   cleanupTempFiles,
// };
