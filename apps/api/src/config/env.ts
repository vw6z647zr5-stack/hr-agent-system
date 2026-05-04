import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidateEnvPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
];

export const ENV_FILE_PATHS = Array.from(new Set(candidateEnvPaths));

for (const envFilePath of ENV_FILE_PATHS) {
  if (!existsSync(envFilePath)) {
    continue;
  }

  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFilePath);
    continue;
  }

  require('dotenv').config({
    path: envFilePath,
    override: false,
  });
}
