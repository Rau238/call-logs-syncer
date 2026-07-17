import fs from 'fs';
import path from 'path';

/**
 * Resolve dashboard build output (apps/dashboard/dist).
 * Works whether API runs from src/ (ts-node) or dist/ (compiled).
 */
export function getDashboardDistPath(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../dashboard/dist'),
    path.resolve(__dirname, '../../../dashboard/dist'),
    path.resolve(process.cwd(), 'apps/dashboard/dist'),
    path.resolve(process.cwd(), '../dashboard/dist'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }

  return null;
}
