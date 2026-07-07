const config = require('../config');

function currentInstance(url = null) {
  if (url) config.set('currentInstance', config.get('allInstances').indexOf(url));
  if (config.has('currentInstance')) return config.get('allInstances')[config.get('currentInstance')];
  return false;
}

function addInstance(url) {
  if (!config.has('allInstances')) config.set('allInstances', []);
  let instances = config.get('allInstances');
  if (instances.find((e) => e === url)) {
    currentInstance(url);
    return;
  }
  if (!instances.length) config.set('disableHover', false);
  instances.push(url);
  config.set('allInstances', instances);
  currentInstance(url);
}

module.exports = { currentInstance, addInstance };
