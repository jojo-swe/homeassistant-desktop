const { execFile } = require('child_process');
const logger = require('electron-log');

let lastWindowTitle = null;
let lastWindowProcess = null;
let pollInterval = null;

const PS_SCRIPT = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  }
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
$title = $sb.ToString()
$pid = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$name = if ($proc) { $proc.Name } else { "Unknown" }
Write-Output "$name|$title"
`;

/**
 * Gets the title and process name of the currently focused window.
 * @returns {Promise<{ process_name: string, window_title: string }>}
 */
function getActiveWindow() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ process_name: null, window_title: null });
      return;
    }

    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT], { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({ process_name: null, window_title: null });
        return;
      }
      const parts = stdout.trim().split('|');
      resolve({
        process_name: parts[0] || null,
        window_title: parts[1] || null,
      });
    });
  });
}

/**
 * Starts polling for active window changes and fires a callback when the window changes.
 * @param {Function} onChange  Called with { process_name, window_title } on change
 * @param {number} intervalMs Poll interval (default: 2000ms)
 */
function startTracking(onChange, intervalMs = 2000) {
  if (pollInterval) return; // already running

  pollInterval = setInterval(async () => {
    const current = await getActiveWindow();
    if (
      current.window_title !== lastWindowTitle ||
      current.process_name !== lastWindowProcess
    ) {
      lastWindowTitle = current.window_title;
      lastWindowProcess = current.process_name;
      try { onChange(current); } catch (e) { logger.error('activeWindow onChange error:', e); }
    }
  }, intervalMs);

  logger.info('Active window tracker started.');
}

function stopTracking() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    logger.info('Active window tracker stopped.');
  }
}

module.exports = { getActiveWindow, startTracking, stopTracking };
