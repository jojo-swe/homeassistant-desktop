import os from 'os';
import { powerMonitor } from 'electron';
import { execFile } from 'child_process';
import si from 'systeminformation';
import type { SystemStats } from './types';

interface MediaDeviceStatus {
  webcam: boolean;
  microphone: boolean;
}

async function getMediaDeviceStatus(): Promise<MediaDeviceStatus> {
  if (process.platform !== 'win32') {
    return { webcam: false, microphone: false };
  }

  return new Promise((resolve) => {
    const psScript = `
      $webcam = $false; $mic = $false;
      $camKey = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam\\NonPackaged';
      $micKey = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged';
      if (Test-Path $camKey) {
        Get-ChildItem $camKey | ForEach-Object {
          $val = Get-ItemProperty -Path $_.PSPath -Name LastUsedTimeStop -ErrorAction SilentlyContinue;
          if ($val -and $val.LastUsedTimeStop -eq 0) { $webcam = $true }
        }
      }
      if (Test-Path $micKey) {
        Get-ChildItem $micKey | ForEach-Object {
          $val = Get-ItemProperty -Path $_.PSPath -Name LastUsedTimeStop -ErrorAction SilentlyContinue;
          if ($val -and $val.LastUsedTimeStop -eq 0) { $mic = $true }
        }
      }
      Write-Output "$webcam|$mic"
    `;

    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve({ webcam: false, microphone: false });
          return;
        }
        const [cam, mic] = stdout.trim().split('|');
        resolve({
          webcam: cam?.toLowerCase() === 'true',
          microphone: mic?.toLowerCase() === 'true',
        });
      }
    );
  });
}

class SystemMonitor {
  static async getStats(): Promise<SystemStats> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(2);

    const idleTime = powerMonitor.getSystemIdleTime();

    const [cpu, battery] = await Promise.all([si.currentLoad().catch(() => null), si.battery().catch(() => null)]);

    const mediaStatus = await getMediaDeviceStatus();

    return {
      memory_usage_percent: parseFloat(memUsage),
      cpu_load_percent: cpu ? parseFloat(cpu.currentLoad.toFixed(2)) : null,
      idle_time_seconds: idleTime,
      is_active: idleTime < 300,
      webcam_active: mediaStatus.webcam,
      microphone_active: mediaStatus.microphone,
      battery_percent: battery?.hasBattery ? battery.percent : null,
      battery_charging: battery?.hasBattery ? battery.isCharging : null,
      hostname: os.hostname(),
      platform: os.platform(),
    };
  }
}

export default SystemMonitor;
