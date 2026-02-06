const fs = require('fs');
const vm = require('vm');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ' (actual=' + String(actual) + ', expected=' + String(expected) + ')');
  }
}

function createProps(initial) {
  const store = Object.assign({}, initial || {});
  return {
    getProperty: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? String(store[key]) : ''),
    setProperty: (key, value) => {
      store[key] = String(value);
    },
    deleteProperty: (key) => {
      delete store[key];
    }
  };
}

const logs = [];
const props = createProps({
  BELLE_X1_CORRELATION_READ_MODE: 'normalized_first'
});
const sandbox = {
  console,
  Logger: { log: (row) => logs.push(row) },
  PropertiesService: {
    getScriptProperties: () => props
  },
  CacheService: {
    getScriptCache: () => ({
      get: () => null,
      put: () => {}
    })
  }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);

const counters = sandbox.belle_corr_createCounters_();
const items = [
  { doc_type: 'receipt', file_id: 'f001', corr_key: 'receipt::f001' },
  { doc_type: 'receipt', file_id: 'f002' },
  { doc_type: 'cc_statement', file_id: 'f003' }
];

for (let i = 0; i < items.length; i++) {
  sandbox.belle_corr_observeItem_('X1_CORR_TEST', counters, items[i], { props: props });
}

expectEqual(counters.missing, 0, 'missing counter must be zero');
expectEqual(counters.invalid, 0, 'invalid-format counter must be zero');
expectEqual(counters.mismatch, 0, 'mismatch counter must be zero');
expectEqual(counters.derived, 2, 'derived-from-legacy counter mismatch');

const signalLogs = logs.filter((row) => row && row.phase === 'X1_CORR_TEST');
expectEqual(signalLogs.length, 3, 'signal count mismatch');
expect(signalLogs.every((row) => typeof row.corr_key === 'string' && row.corr_key.indexOf('::') > 0), 'corr_key format mismatch');

console.log('OK: x1_correlation_observability_counters');
