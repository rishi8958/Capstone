const { FakeInstagramAdapter, FakeXAdapter } = require('./FakePlatformAdapters');

const registry = {
  instagram: new FakeInstagramAdapter(),
  x: new FakeXAdapter(),
};

function getAdapter(platformId) {
  const adapter = registry[platformId];
  if (!adapter) throw new Error(`No adapter registered for platform: ${platformId}`);
  return adapter;
}

module.exports = { getAdapter };
