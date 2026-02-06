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
    },
    deleteProperty: (key) => {
      delete store[key];
    }
  };
}

const props = createProps({
  BELLE_X1_CORRELATION_READ_MODE: 'normalized_first'
});
const logs = [];
const sandbox = {
  console,
  Date: createFixedDate(1760000000000),
  Math: createFixedMath(0.5),
  Logger: { log: (row) => logs.push(row) },
  PropertiesService: { getScriptProperties: () => props },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('gas/Config.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/DashboardApi.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/Queue.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/OcrWorkerParallel.js', 'utf8'), sandbox);
vm.runInContext(fs.readFileSync('gas/Export.js', 'utf8'), sandbox);

const longSamples = [];
for (let i = 0; i < 30; i++) longSamples.push('receipt::f' + String(i));
longSamples.push('invalid');
longSamples.push('receipt::f0');

const dashboardRes = sandbox.belle_dash_wrap_('op_queue', () => ({
  ok: true,
  reason: 'OK',
  message: 'Queue complete.',
  data: {
    queued: 1,
    sample_corr_keys: longSamples
  }
}));

expectEqual(dashboardRes.ok, true, 'dashboard response must be ok');
expectEqual(dashboardRes.data.corr_action_key, 'op_queue::dash_1760000000000_apsw', 'dashboard corr_action_key mismatch');
expect(Array.isArray(dashboardRes.data.sample_corr_keys), 'dashboard sample_corr_keys must be array');
expectEqual(dashboardRes.data.sample_corr_keys.length, 20, 'dashboard sample_corr_keys must be capped to 20');
const expectedCorrKey = dashboardRes.data.sample_corr_keys[0];
expectEqual(expectedCorrKey, 'receipt::f0', 'dashboard first sample corr key mismatch');

const queueCounters = sandbox.belle_corr_createCounters_();
const queueResolved = sandbox.belle_queue_observeCorr_(queueCounters, {
  doc_type: 'receipt',
  file_id: 'f0',
  queue_sheet_name: 'OCR_RECEIPT',
  rowIndex: 2
}, props);

const workerCounters = sandbox.belle_corr_createCounters_();
const workerResolved = sandbox.belle_ocr_worker_observeCorr_(workerCounters, {
  doc_type: 'receipt',
  file_id: 'f0',
  queue_sheet_name: 'OCR_RECEIPT',
  rowIndex: 2
}, props);

const exportCounters = sandbox.belle_corr_createCounters_();
const exportResolved = sandbox.belle_export_observeCorr_(exportCounters, {
  doc_type: 'receipt',
  file_id: 'f0',
  queue_sheet_name: 'OCR_RECEIPT',
  rowIndex: 2
}, props);

expectEqual(queueResolved.corr_key, expectedCorrKey, 'queue corr_key mismatch');
expectEqual(workerResolved.corr_key, expectedCorrKey, 'worker corr_key mismatch');
expectEqual(exportResolved.corr_key, expectedCorrKey, 'export corr_key mismatch');

expectEqual(queueCounters.missing, 0, 'queue missing counter must be zero');
expectEqual(queueCounters.invalid, 0, 'queue invalid counter must be zero');
expectEqual(queueCounters.mismatch, 0, 'queue mismatch counter must be zero');
expectEqual(workerCounters.missing, 0, 'worker missing counter must be zero');
expectEqual(workerCounters.invalid, 0, 'worker invalid counter must be zero');
expectEqual(workerCounters.mismatch, 0, 'worker mismatch counter must be zero');
expectEqual(exportCounters.missing, 0, 'export missing counter must be zero');
expectEqual(exportCounters.invalid, 0, 'export invalid counter must be zero');
expectEqual(exportCounters.mismatch, 0, 'export mismatch counter must be zero');

const phaseSet = new Set(logs.map((row) => (row && row.phase ? row.phase : '')));
expect(phaseSet.has('X1_CORR_DASH_ACTION'), 'missing X1_CORR_DASH_ACTION signal');
expect(phaseSet.has('X1_CORR_QUEUE_ITEM'), 'missing X1_CORR_QUEUE_ITEM signal');
expect(phaseSet.has('X1_CORR_WORKER_ITEM'), 'missing X1_CORR_WORKER_ITEM signal');
expect(phaseSet.has('X1_CORR_EXPORT_ITEM'), 'missing X1_CORR_EXPORT_ITEM signal');

console.log('OK: x1_correlation_e2e_dashboard_queue_worker_export');
