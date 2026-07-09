import config from './config';

export function currentInstance(url?: string | null): string | false {
  if (url) {
    const idx = config.get('allInstances').indexOf(url);
    if (idx !== -1) config.set('currentInstance', idx);
  }
  if (config.has('currentInstance')) {
    const idx = config.get('currentInstance');
    if (idx === undefined) return false;
    return config.get('allInstances')[idx] ?? false;
  }
  return false;
}

export function addInstance(url: string): void {
  if (!config.has('allInstances')) config.set('allInstances', []);
  const instances = config.get('allInstances');
  if (instances.find((e) => e === url)) {
    currentInstance(url);
    return;
  }
  if (!instances.length) config.set('disableHover', false);
  instances.push(url);
  config.set('allInstances', instances);
  currentInstance(url);
}
