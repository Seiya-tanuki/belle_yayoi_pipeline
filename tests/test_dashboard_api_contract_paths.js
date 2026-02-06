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

function createPropsStore(initial) {
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

function createGridSheet(header, rows) {
  const head = header.slice();
  const body = rows.map((row) => row.slice());
  return {
    getLastRow: () => body.length + 1,
    getLastColumn: () => head.length,
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => {
        if (row === 1) {
          return [head.slice(col - 1, col - 1 + numCols)];
        }
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const src = body[row - 2 + i] || [];
          out.push(src.slice(col - 1, col - 1 + numCols));
        }
        return out;
      }
    })
  };
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
  const props = createPropsStore(opts.props || {});
  const sheetBook = opts.sheetBook || { getSheetByName: () => null };

  const sandbox = {
    console,
    Date: createFixedDate(1760000000000),
    Math: createFixedMath(0.5),
    SpreadsheetApp: {
      openById: () => {
        if (opts.openByIdError) throw new Error(opts.openByIdError);
        return sheetBook;
      }
    },
    belle_cfg_getProps_: () => props,
    belle_cfg_getSheetIdOrEmpty_: (inProps) => String(inProps.getProperty('BELLE_SHEET_ID') || ''),
    belle_ocr_getActiveDocTypes_: () => (opts.activeDocTypes || []),
    belle_getQueueHeaderColumns: () => ['status', 'file_id'],
    belle_getQueueLockHeaderColumns_: () => [],
    belle_docType_getSpec_: (docType) => ({ doc_type: String(docType) }),
    belle_ocr_getQueueSheetNameForDocType_: (_props, docType) => String(docType).toUpperCase() + '_QUEUE',
    belle_queue_ensureHeaderMapCanonical_: () => ({ status: 0, file_id: 1 }),
    belle_getExportGuardLogSheetName: () => 'EXPORT_GUARD_LOG',
    belle_getSkipLogSheetName: () => 'EXPORT_SKIP_LOG',
    belle_getQueueSkipLogSheetName: () => 'QUEUE_SKIP_LOG'
  };

  if (!opts.healthCheckMissing) {
    sandbox.belle_env_healthCheck_ = opts.healthCheckImpl || (() => ({
      ok: true,
      data: { ready: true }
    }));
  }

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('gas/DashboardApi.js', 'utf8'), sandbox);
  return { sandbox };
}

function testOverviewSuccessContract() {
  const overviewSheet = createGridSheet(
    ['status', 'file_id'],
    [
      ['QUEUED', 'id-1'],
      ['PROCESSING', 'id-2'],
      ['ERROR', 'id-3'],
      ['DONE', 'id-4'],
      ['UNEXPECTED', 'id-5']
    ]
  );
  const ctx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    activeDocTypes: ['receipt'],
    sheetBook: {
      getSheetByName: (name) => (name === 'RECEIPT_QUEUE' ? overviewSheet : null)
    }
  });

  const res = ctx.sandbox.belle_dash_getOverview();
  expectEnvelope(res, 'overview', 'overview success');
  expectEqual(res.ok, true, 'overview success should be ok');
  expectEqual(res.reason, 'OK', 'overview success reason mismatch');
  expectEqual(res.message, 'Overview ready.', 'overview success message mismatch');
  expectEqual(Array.isArray(res.data.docTypes), true, 'overview should include docTypes');
  expectEqual(res.data.docTypes.length, 1, 'overview should include one docType');
  expectEqual(res.data.docTypes[0].docType, 'receipt', 'overview docType mismatch');
  expectEqual(res.data.docTypes[0].queueSheetName, 'RECEIPT_QUEUE', 'overview queue sheet name mismatch');
  expectEqual(res.data.docTypes[0].missing, false, 'overview missing flag mismatch');
  expectEqual(res.data.docTypes[0].invalidHeader, false, 'overview invalidHeader flag mismatch');
  expectEqual(res.data.docTypes[0].counts.queued, 2, 'overview queued count mismatch');
  expectEqual(res.data.docTypes[0].counts.processing, 1, 'overview processing count mismatch');
  expectEqual(res.data.docTypes[0].counts.error_retryable, 1, 'overview retryable count mismatch');
  expectEqual(res.data.docTypes[0].counts.error_final, 0, 'overview error_final count mismatch');
  expectEqual(res.data.docTypes[0].counts.done, 1, 'overview done count mismatch');
  expectEqual(res.data.docTypes[0].counts.total, 5, 'overview total count mismatch');
  expectEqual(res.data.docTypes[0].unknownCount, 1, 'overview unknown count mismatch');
  expectEqual(res.data.totals.queued, 2, 'overview totals queued mismatch');
  expectEqual(res.data.totals.processing, 1, 'overview totals processing mismatch');
  expectEqual(res.data.totals.error_retryable, 1, 'overview totals retryable mismatch');
  expectEqual(res.data.totals.error_final, 0, 'overview totals error_final mismatch');
  expectEqual(res.data.totals.done, 1, 'overview totals done mismatch');
  expectEqual(res.data.totals.total, 5, 'overview totals total mismatch');
  expectEqual(res.data.unknownCount, 1, 'overview totals unknown count mismatch');
  expectEqual(res.data.corr_action_key, 'overview::dash_1760000000000_apsw', 'overview corr_action_key mismatch');
  expectEqual(Array.isArray(res.data.sample_corr_keys), true, 'overview sample_corr_keys should be array');
  expectEqual(res.data.sample_corr_keys.length, 0, 'overview sample_corr_keys should be empty');
}

function testLogsSuccessContract() {
  const guardSheet = createGridSheet(
    ['logged_at_iso', 'reason', 'doc_type', 'counts_json'],
    [
      ['2026-02-06T00:00:00.000Z', 'GUARD_OLD', 'receipt', '{"total":2,"done":1,"queued":1,"retryable":0,"error_final":0}'],
      ['2026-02-06T00:01:00.000Z', 'GUARD_NEW', 'cc_statement', '{"total":4,"done":2,"queued":1,"retryable":1,"error_final":0}']
    ]
  );
  const exportSkipSheet = createGridSheet(
    ['logged_at_iso', 'reason', 'doc_type'],
    [
      ['2026-02-06T00:02:00.000Z', 'SKIP_OLD', 'receipt'],
      ['2026-02-06T00:03:00.000Z', 'SKIP_NEW', 'bank_statement']
    ]
  );
  const queueSkipSheet = createGridSheet(
    ['logged_at_iso', 'reason', 'doc_type', 'seen_count'],
    [
      ['2026-02-06T00:04:00.000Z', 'QUEUE_OLD', 'receipt', '7'],
      ['2026-02-06T00:05:00.000Z', 'QUEUE_NEW', 'cc_statement', '9']
    ]
  );
  const sheetByName = {
    EXPORT_GUARD_LOG: guardSheet,
    EXPORT_SKIP_LOG: exportSkipSheet,
    QUEUE_SKIP_LOG: queueSkipSheet
  };
  const ctx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    sheetBook: {
      getSheetByName: (name) => (Object.prototype.hasOwnProperty.call(sheetByName, name) ? sheetByName[name] : null)
    }
  });

  const res = ctx.sandbox.belle_dash_getLogs();
  expectEnvelope(res, 'logs', 'logs success');
  expectEqual(res.ok, true, 'logs success should be ok');
  expectEqual(res.reason, 'OK', 'logs success reason mismatch');
  expectEqual(res.message, 'Logs ready.', 'logs success message mismatch');
  expectEqual(res.data.limit, 50, 'logs limit mismatch');

  expectEqual(res.data.sheets.exportGuard.sheetName, 'EXPORT_GUARD_LOG', 'guard sheet name mismatch');
  expectEqual(res.data.sheets.exportGuard.missing, false, 'guard missing mismatch');
  expectEqual(res.data.sheets.exportGuard.totalRows, 2, 'guard totalRows mismatch');
  expectEqual(res.data.sheets.exportGuard.rows.length, 2, 'guard row length mismatch');
  expectEqual(res.data.sheets.exportGuard.rows[0].reason, 'GUARD_NEW', 'guard row order mismatch');
  expectEqual(res.data.sheets.exportGuard.rows[0].doc_type, 'cc_statement', 'guard doc_type mismatch');
  expectEqual(res.data.sheets.exportGuard.rows[0].counts.total, 4, 'guard counts total mismatch');
  expectEqual(res.data.sheets.exportGuard.rows[0].counts.done, 2, 'guard counts done mismatch');
  expectEqual(res.data.sheets.exportGuard.rows[0].counts.queued, 1, 'guard counts queued mismatch');
  expectEqual(res.data.sheets.exportGuard.rows[0].counts.retryable, 1, 'guard counts retryable mismatch');
  expectEqual(res.data.sheets.exportGuard.rows[0].counts.error_final, 0, 'guard counts error_final mismatch');

  expectEqual(res.data.sheets.exportSkip.totalRows, 2, 'exportSkip totalRows mismatch');
  expectEqual(res.data.sheets.exportSkip.rows[0].reason, 'SKIP_NEW', 'exportSkip row order mismatch');
  expectEqual(res.data.sheets.exportSkip.rows[0].doc_type, 'bank_statement', 'exportSkip doc_type mismatch');

  expectEqual(res.data.sheets.queueSkip.totalRows, 2, 'queueSkip totalRows mismatch');
  expectEqual(res.data.sheets.queueSkip.rows[0].reason, 'QUEUE_NEW', 'queueSkip row order mismatch');
  expectEqual(res.data.sheets.queueSkip.rows[0].doc_type, 'cc_statement', 'queueSkip doc_type mismatch');
  expectEqual(res.data.sheets.queueSkip.rows[0].seen_count, 9, 'queueSkip seen_count mismatch');
  expectEqual(res.data.corr_action_key, 'logs::dash_1760000000000_apsw', 'logs corr_action_key mismatch');
  expectEqual(Array.isArray(res.data.sample_corr_keys), true, 'logs sample_corr_keys should be array');
  expectEqual(res.data.sample_corr_keys.length, 0, 'logs sample_corr_keys should be empty');
}

function testEnvFailureBranches() {
  const missingCtx = buildSandbox({
    healthCheckMissing: true
  });
  const missingRes = missingCtx.sandbox.belle_dash_getOverview();
  expectEnvelope(missingRes, 'overview', 'env missing');
  expectEqual(missingRes.ok, false, 'missing env should fail');
  expectEqual(missingRes.reason, 'ENV_CHECK_MISSING', 'missing env reason mismatch');
  expectEqual(missingRes.message, 'Environment check unavailable.', 'missing env message mismatch');
  expectEqual(missingRes.data, null, 'missing env data should be null');

  const failedCtx = buildSandbox({
    healthCheckImpl: () => ({
      ok: false,
      data: { stage: 'failed' }
    })
  });
  const failedRes = failedCtx.sandbox.belle_dash_getOverview();
  expectEnvelope(failedRes, 'overview', 'env check failed');
  expectEqual(failedRes.ok, false, 'failed env should fail');
  expectEqual(failedRes.reason, 'ENV_CHECK_FAILED', 'failed env reason mismatch');
  expectEqual(failedRes.message, 'Environment check failed.', 'failed env message mismatch');
  expectEqual(failedRes.data.stage, 'failed', 'failed env data mismatch');

  const notReadyCtx = buildSandbox({
    healthCheckImpl: () => ({
      ok: true,
      data: { ready: false, stage: 'booting' }
    })
  });
  const notReadyRes = notReadyCtx.sandbox.belle_dash_getOverview();
  expectEnvelope(notReadyRes, 'overview', 'env not ready');
  expectEqual(notReadyRes.ok, false, 'not ready env should fail');
  expectEqual(notReadyRes.reason, 'ENV_NOT_READY', 'not ready env reason mismatch');
  expectEqual(notReadyRes.message, 'Environment not ready.', 'not ready env message mismatch');
  expectEqual(notReadyRes.data.stage, 'booting', 'not ready env data mismatch');
}

function testMissingSheetIdFailures() {
  const ctx = buildSandbox({
    props: {}
  });

  const overviewRes = ctx.sandbox.belle_dash_getOverview();
  expectEnvelope(overviewRes, 'overview', 'overview missing sheet id');
  expectEqual(overviewRes.ok, false, 'overview missing sheet id should fail');
  expectEqual(overviewRes.reason, 'MISSING_SHEET_ID', 'overview missing sheet id reason mismatch');
  expectEqual(overviewRes.message, 'Missing BELLE_SHEET_ID.', 'overview missing sheet id message mismatch');
  expectEqual(overviewRes.data, null, 'overview missing sheet id data mismatch');

  const logsRes = ctx.sandbox.belle_dash_getLogs();
  expectEnvelope(logsRes, 'logs', 'logs missing sheet id');
  expectEqual(logsRes.ok, false, 'logs missing sheet id should fail');
  expectEqual(logsRes.reason, 'MISSING_SHEET_ID', 'logs missing sheet id reason mismatch');
  expectEqual(logsRes.message, 'Missing BELLE_SHEET_ID.', 'logs missing sheet id message mismatch');
  expectEqual(logsRes.data, null, 'logs missing sheet id data mismatch');
}

function testWrapperExceptionBranch() {
  const ctx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    activeDocTypes: ['receipt'],
    openByIdError: 'open failed'
  });
  const res = ctx.sandbox.belle_dash_getOverview();

  expectEnvelope(res, 'overview', 'overview exception');
  expectEqual(res.ok, false, 'overview exception should fail');
  expectEqual(res.reason, 'EXCEPTION', 'overview exception reason mismatch');
  expect(res.message.indexOf('open failed') >= 0, 'overview exception should include thrown message');
  expectEqual(res.data, null, 'overview exception data should be null');
}

testOverviewSuccessContract();
testLogsSuccessContract();
testEnvFailureBranches();
testMissingSheetIdFailures();
testWrapperExceptionBranch();

console.log('OK: test_dashboard_api_contract_paths');
