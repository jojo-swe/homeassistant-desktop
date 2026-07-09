import { net } from 'electron';
import { Bonjour } from 'bonjour-service';
import logger from 'electron-log';
import config from './config';
import { currentInstance } from './instances';

let availabilityCheckerInterval: NodeJS.Timeout | null = null;
let bonjour: Bonjour | null = null;
let connected = false;
let consecutiveFailures = 0;
let currentDeps: AvailabilityDeps | null = null;

interface AvailabilityDeps {
  showError: (isError: boolean) => Promise<void>;
  onStatusChange?: (connected: boolean) => void;
}

function init(deps: AvailabilityDeps): void {
  currentDeps = deps;
  if (!availabilityCheckerInterval) {
    logger.info('Initialized availability check');
    availabilityCheckerInterval = setInterval(() => {
      if (currentDeps) availabilityCheck(currentDeps);
    }, 3000);
  }
}

function stop(): void {
  if (availabilityCheckerInterval) {
    clearInterval(availabilityCheckerInterval);
    availabilityCheckerInterval = null;
  }
  currentDeps = null;
}

function setConnected(value: boolean): void {
  if (connected === value) return;
  connected = value;
  if (currentDeps?.onStatusChange) currentDeps.onStatusChange(value);
}

function isConnected(): boolean {
  return connected;
}

function availabilityCheck(deps: AvailabilityDeps): void {
  const instance = currentInstance();
  if (!instance) return;

  let url: URL;
  try {
    url = new URL(instance);
  } catch {
    logger.error(`Invalid stored instance URL: "${instance}"`);
    return;
  }
  const request = net.request(`${url.origin}/auth/providers`);

  request.on('response', async (response) => {
    if (response.statusCode === 200) {
      consecutiveFailures = 0;
      setConnected(true);
      await deps.showError(false);
    } else {
      logger.error('Response error: ' + response);
      consecutiveFailures++;
      setConnected(false);
      await deps.showError(true);
    }
  });

  request.on('error', async (error) => {
    logger.error(error);
    consecutiveFailures++;
    setConnected(false);
    await deps.showError(true);

    if (config.get('automaticSwitching')) checkForAvailableInstance();
  });

  request.end();
}

function checkForAvailableInstance(): void {
  const instances = config.get('allInstances');
  if (!instances || instances.length <= 1) return;

  if (!bonjour) bonjour = new Bonjour();

  bonjour.find({ type: 'home-assistant' }, (instance) => {
    const internalUrl = instance.txt?.internal_url;
    const externalUrl = instance.txt?.external_url;
    if (internalUrl && instances.indexOf(internalUrl) !== -1) return currentInstance(internalUrl);
    if (externalUrl && instances.indexOf(externalUrl) !== -1) return currentInstance(externalUrl);
  });

  const otherInstances = instances.filter((e) => e !== currentInstance());
  Promise.all(
    otherInstances.map(
      (instance) =>
        new Promise<string | null>((resolve) => {
          let url: URL;
          try {
            url = new URL(instance);
          } catch {
            resolve(null);
            return;
          }
          const request = net.request(`${url.origin}/auth/providers`);
          request.on('response', (response) => {
            resolve(response.statusCode === 200 ? instance : null);
          });
          request.on('error', () => resolve(null));
          request.end();
        })
    )
  ).then((results) => {
    const found = results.find((r) => r !== null);
    if (found) currentInstance(found);
  });
}

function getBonjour(): Bonjour {
  if (!bonjour) bonjour = new Bonjour();
  return bonjour;
}

export { init, stop, availabilityCheck, checkForAvailableInstance, getBonjour, isConnected };
