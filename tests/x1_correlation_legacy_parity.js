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

function createFixedDate(nowMs) {
  const RealDate = Date;
  return class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(nowMs);
      else super(...args);
    }
    static now() { return nowMs; }
    static parse(value) { return RealDate.parse(value); }
    static UTC(...args) { return RealDate.UTC(...args); }
  };
}

function createFixedMath(randomValue) {
  const fixedMath = Object.create(Math);
  fixedMath.random = () => randomValue;
  return fixedMath;
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

const props = createProps({
  BELLE_X1_CORRELATION_READ_MODE: 'compatibility'
});
const sandbox = {
  console,
  Date: createFixedDate(1760000000000),
  Math: createFixedMath(0.5),
  Logger: { log: () => {} },
  PropertiesService: {
    getScriptProperties: () => props
  },
  CacheService: {
    getScriptCache: () => ({ get: () => null, put: () => {} })
  }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/DashboardApi.js', 'utf8'), sandbox);

const wrapped = sandbox.belle_dash_wrap_('legacy_probe', () => ({
  ok: true,
  reason: 'OK',
  message: 'legacy',
  data: {
    rid: 'RID_1',
    run_id: 'RUN_1',
    file_id: 'FILE_1',
    status: 'DONE',
    outcome: 'OK'
  }
}));

expectEqual(typeof wrapped.rid, 'string', 'rid type mismatch');
expectEqual(wrapped.action, 'legacy_probe', 'action mismatch');
expectEqual(wrapped.reason, 'OK', 'reason mismatch');
expectEqual(wrapped.message, 'legacy', 'message mismatch');
expectEqual(wrapped.data.run_id, 'RUN_1', 'legacy run_id must remain');
expectEqual(wrapped.data.file_id, 'FILE_1', 'legacy file_id must remain');
expectEqual(wrapped.data.status, 'DONE', 'legacy status must remain');
expectEqual(wrapped.data.outcome, 'OK', 'legacy outcome must remain');
expectEqual(wrapped.data.corr_action_key, 'legacy_probe::dash_1760000000000_apsw', 'corr_action_key mismatch');
expectEqual(Array.isArray(wrapped.data.sample_corr_keys), true, 'sample_corr_keys must be array');

const compatRes = sandbox.belle_corr_resolveItemKey_(
  { doc_type: 'receipt', file_id: 'FILE_1' },
  { props: props, mode: 'compatibility' }
);
const normalizedRes = sandbox.belle_corr_resolveItemKey_(
  { doc_type: 'receipt', file_id: 'FILE_1' },
  { props: props, mode: 'normalized_first' }
);
expectEqual(compatRes.corr_key, 'receipt::FILE_1', 'compat corr_key mismatch');
expectEqual(normalizedRes.corr_key, 'receipt::FILE_1', 'normalized corr_key mismatch');
expectEqual(compatRes.missing, false, 'compat missing mismatch');
expectEqual(normalizedRes.missing, false, 'normalized missing mismatch');

console.log('OK: x1_correlation_legacy_parity');
