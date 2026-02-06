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
    }
  };
}

const compatProps = createProps({ BELLE_X1_CORRELATION_READ_MODE: 'compatibility' });
const normalizedProps = createProps({ BELLE_X1_CORRELATION_READ_MODE: 'normalized_first' });
const sandbox = {
  console,
  Logger: { log: () => {} },
  PropertiesService: { getScriptProperties: () => compatProps },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);

const cases = [
  { doc_type: 'receipt', file_id: 'F100' },
  { doc_type: 'receipt', file_id: 'F101', corr_key: 'receipt::F101' },
  { doc_type: 'receipt', file_id: 'F102', corr_key: 'bad-format' }
];

for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const compat = sandbox.belle_corr_resolveItemKey_(c, { props: compatProps });
  const normalized = sandbox.belle_corr_resolveItemKey_(c, { props: normalizedProps });
  expectEqual(compat.corr_key, normalized.corr_key, 'mode parity corr_key mismatch at index ' + i);
  expectEqual(compat.missing, normalized.missing, 'mode parity missing mismatch at index ' + i);
}

const fallback = sandbox.belle_corr_resolveItemKey_(
  { doc_type: 'bank_statement', file_id: 'B200' },
  { props: normalizedProps }
);
expectEqual(fallback.corr_key, 'bank_statement::B200', 'normalized-first fallback corr_key mismatch');
expectEqual(fallback.derived_from_legacy, true, 'normalized-first fallback must derive from legacy');
expectEqual(fallback.missing, false, 'normalized-first fallback should not be missing');

expect(typeof sandbox.belle_corr_cleanupLegacyAliases_ === 'undefined', 'cleanup path must not be active in this track');

console.log('OK: x1_correlation_mode_switch_parity');
