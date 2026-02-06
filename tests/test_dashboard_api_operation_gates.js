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
      if (args.length === 0) {
        super(nowMs);
      } else {
        super(...args);
      }
    }
    static now() {
      return nowMs;
    }
    static parse(value) {
      return RealDate.parse(value);
    }
    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  };
}

function createFixedMath(randomValue) {
  const fixedMath = Object.create(Math);
  fixedMath.random = () => randomValue;
  return fixedMath;
}

function expectEnvelope(res, action, messagePrefix) {
  expect(typeof res === 'object' && res !== null, messagePrefix + ': response must be object');
  expectEqual(res.action, action, messagePrefix + ': action mismatch');
  expectEqual(typeof res.ok, 'boolean', messagePrefix + ': ok must be boolean');
  expectEqual(typeof res.rid, 'string', messagePrefix + ': rid must be string');
  expectEqual(res.rid, 'dash_1760000000000_apsw', messagePrefix + ': rid mismatch');
  expectEqual(typeof res.reason, 'string', messagePrefix + ': reason must be string');
  expectEqual(typeof res.message, 'string', messagePrefix + ': message must be string');
  expect(Object.prototype.hasOwnProperty.call(res, 'data'), messagePrefix + ': data must exist');
}

function buildSandbox(options) {
  const opts = options || {};
  const requireModeCalls = [];

  const sandbox = {
    console,
    Date: createFixedDate(1760000000000),
    Math: createFixedMath(0.5),
    belle_env_healthCheck_: opts.healthCheckImpl || (() => ({ ok: true, data: { ready: true } })),
    belle_maint_requireMode_: (mode) => {
      requireModeCalls.push(mode);
      if (opts.requireModeImpl) return opts.requireModeImpl(mode);
      return { ok: true, reason: 'OK', message: 'OK', data: { mode: mode } };
    },
    belle_queueFolderFilesToSheet: () => (opts.queueRes || { queued: 0, skipped: 0, totalListed: 0, queuedByDocType: {} }),
    belle_ocr_parallel_enable: () => (opts.ocrEnableRes || { createdNew: 0, deletedOld: 0 }),
    belle_ocr_parallel_disable: () => (opts.ocrDisableRes || { deleted: 0, existed: 0 }),
    belle_export_run_maintenance_: () => (opts.opExportRes || { ok: true, reason: 'OK', message: 'OK', data: null }),
    belle_dash_maint_enter_: () => (opts.enterMaintenanceRes || { ok: true, reason: 'OK', message: 'OK', data: null }),
    belle_dash_maint_archiveLogs_: () => (opts.archiveLogsRes || { ok: true, reason: 'OK', message: 'OK', data: null }),
    belle_dash_maint_archiveImages_: () => (opts.archiveImagesRes || { ok: true, reason: 'OK', message: 'OK', data: null }),
    belle_dash_maint_exportRun_: () => (opts.exportRunRes || { ok: true, reason: 'OK', message: 'OK', data: null })
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('gas/DashboardApi.js', 'utf8'), sandbox);
  return {
    sandbox,
    getRequireModeCalls: () => requireModeCalls.slice()
  };
}

function testOcrGateFailurePaths() {
  const gateFail = {
    ok: false,
    reason: 'MODE_NOT_OCR',
    message: 'Mode must be OCR.',
    data: { mode: 'MAINTENANCE' }
  };
  const ctx = buildSandbox({
    requireModeImpl: (mode) => {
      if (mode === 'OCR') return gateFail;
      return { ok: true, reason: 'OK', message: 'OK', data: { mode: mode } };
    }
  });
  const operations = [
    { fn: 'belle_dash_opQueue', action: 'op_queue' },
    { fn: 'belle_dash_opOcrEnable', action: 'op_ocr_enable' },
    { fn: 'belle_dash_opOcrDisable', action: 'op_ocr_disable' },
    { fn: 'belle_dash_enterMaintenance', action: 'maint_enter' }
  ];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const res = ctx.sandbox[op.fn]();
    expectEnvelope(res, op.action, op.fn + ' OCR gate fail');
    expectEqual(res.ok, false, op.fn + ' should fail on OCR gate mismatch');
    expectEqual(res.reason, 'MODE_NOT_OCR', op.fn + ' OCR gate reason mismatch');
    expectEqual(res.message, 'Mode must be OCR.', op.fn + ' OCR gate message mismatch');
    expectEqual(res.data.mode, 'MAINTENANCE', op.fn + ' OCR gate mode mismatch');
  }

  const calls = ctx.getRequireModeCalls();
  expectEqual(calls.length, operations.length, 'OCR gate should be checked for each OCR operation');
  for (let i = 0; i < calls.length; i++) {
    expectEqual(calls[i], 'OCR', 'OCR operation should require OCR mode');
  }
}

function testMaintenanceGateFailurePaths() {
  const gateFail = {
    ok: false,
    reason: 'MODE_NOT_MAINTENANCE',
    message: 'Mode must be MAINTENANCE.',
    data: { mode: 'OCR' }
  };
  const ctx = buildSandbox({
    requireModeImpl: (mode) => {
      if (mode === 'MAINTENANCE') return gateFail;
      return { ok: true, reason: 'OK', message: 'OK', data: { mode: mode } };
    }
  });
  const operations = [
    { fn: 'belle_dash_opExport', action: 'op_export' },
    { fn: 'belle_dash_archiveLogs', action: 'maint_archive_logs' },
    { fn: 'belle_dash_archiveImages', action: 'maint_archive_images' },
    { fn: 'belle_dash_exportRun', action: 'maint_export_run' }
  ];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const res = ctx.sandbox[op.fn]();
    expectEnvelope(res, op.action, op.fn + ' maintenance gate fail');
    expectEqual(res.ok, false, op.fn + ' should fail on maintenance gate mismatch');
    expectEqual(res.reason, 'MODE_NOT_MAINTENANCE', op.fn + ' maintenance gate reason mismatch');
    expectEqual(res.message, 'Mode must be MAINTENANCE.', op.fn + ' maintenance gate message mismatch');
    expectEqual(res.data.mode, 'OCR', op.fn + ' maintenance gate mode mismatch');
  }

  const calls = ctx.getRequireModeCalls();
  expectEqual(calls.length, operations.length, 'maintenance gate should be checked for each maintenance operation');
  for (let i = 0; i < calls.length; i++) {
    expectEqual(calls[i], 'MAINTENANCE', 'maintenance operation should require MAINTENANCE mode');
  }
}

function testQueueSuccessPath() {
  const ctx = buildSandbox({
    queueRes: {
      queued: 3,
      skipped: 2,
      totalListed: 7,
      queuedByDocType: { receipt: 1, cc_statement: 2 }
    }
  });
  const res = ctx.sandbox.belle_dash_opQueue();

  expectEnvelope(res, 'op_queue', 'opQueue success');
  expectEqual(res.ok, true, 'opQueue success should be ok');
  expectEqual(res.reason, 'OK', 'opQueue success reason mismatch');
  expectEqual(res.message, 'Queue complete.', 'opQueue success message mismatch');
  expectEqual(res.data.queued, 3, 'opQueue queued mismatch');
  expectEqual(res.data.skipped, 2, 'opQueue skipped mismatch');
  expectEqual(res.data.totalListed, 7, 'opQueue totalListed mismatch');
  expectEqual(res.data.queuedByDocType.receipt, 1, 'opQueue queuedByDocType receipt mismatch');
  expectEqual(res.data.queuedByDocType.cc_statement, 2, 'opQueue queuedByDocType cc mismatch');
}

function testOcrEnableBlockedBranch() {
  const requested = { mode: 'OCR', source: 'dashboard' };
  const ctx = buildSandbox({
    ocrEnableRes: {
      reason: 'ALREADY_RUNNING',
      requested: requested
    }
  });
  const res = ctx.sandbox.belle_dash_opOcrEnable();

  expectEnvelope(res, 'op_ocr_enable', 'opOcrEnable blocked');
  expectEqual(res.ok, false, 'opOcrEnable blocked should fail');
  expectEqual(res.reason, 'OCR_ENABLE_BLOCKED', 'opOcrEnable blocked reason mismatch');
  expectEqual(res.message, 'OCR enable blocked: ALREADY_RUNNING', 'opOcrEnable blocked message mismatch');
  expectEqual(res.data.reason, 'ALREADY_RUNNING', 'opOcrEnable blocked payload reason mismatch');
  expect(res.data.requested === requested, 'opOcrEnable blocked payload should preserve requested object');
}

function testExportRunSuccessPath() {
  const payload = {
    ok: true,
    reason: 'OK',
    message: 'Maintenance export run completed.',
    data: {
      run_id: 'RUN_001',
      processed: 5
    }
  };
  const ctx = buildSandbox({
    exportRunRes: payload
  });
  const res = ctx.sandbox.belle_dash_exportRun();

  expectEnvelope(res, 'maint_export_run', 'exportRun success');
  expectEqual(res.ok, true, 'exportRun success should be ok');
  expectEqual(res.reason, 'OK', 'exportRun success reason mismatch');
  expectEqual(res.message, 'Maintenance export run completed.', 'exportRun success message mismatch');
  expectEqual(res.data.run_id, 'RUN_001', 'exportRun run_id mismatch');
  expectEqual(res.data.processed, 5, 'exportRun processed mismatch');
}

testOcrGateFailurePaths();
testMaintenanceGateFailurePaths();
testQueueSuccessPath();
testOcrEnableBlockedBranch();
testExportRunSuccessPath();

console.log('OK: test_dashboard_api_operation_gates');
