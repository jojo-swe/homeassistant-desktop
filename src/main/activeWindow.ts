import { execFile } from 'child_process';
import logger from 'electron-log';
import type { ActiveWindowInfo } from './types';

let lastWindowTitle: string | null = null;
let lastWindowProcess: string | null = null;
let pollInterval: NodeJS.Timeout | null = null;

const PS_SCRIPT = `
$procs = Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Sort-Object CPU -Descending;
$top = $procs | Select-Object -First 1;
if ($top) { Write-Output "$($top.Name)|$($top.MainWindowTitle)" } else { Write-Output '|' }
`;

function getActiveWindow(): Promise<ActiveWindowInfo> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ process_name: null, window_title: null });
      return;
    }

    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve({ process_name: null, window_title: null });
          return;
        }
        const parts = stdout.trim().split('|');
        resolve({
          process_name: parts[0] || null,
          window_title: parts[1] || null,
        });
      }
    );
  });
}

function startTracking(onChange: (info: ActiveWindowInfo) => void, intervalMs: number = 2000): void {
  if (pollInterval) return;

  pollInterval = setInterval(async () => {
    const current = await getActiveWindow();
    if (current.window_title !== lastWindowTitle || current.process_name !== lastWindowProcess) {
      lastWindowTitle = current.window_title;
      lastWindowProcess = current.process_name;
      try {
        onChange(current);
      } catch (e) {
        logger.error('activeWindow onChange error:', e);
      }
    }
  }, intervalMs);

  logger.info('Active window tracker started.');
}

function stopTracking(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    logger.info('Active window tracker stopped.');
  }
}

export { getActiveWindow, startTracking, stopTracking };
