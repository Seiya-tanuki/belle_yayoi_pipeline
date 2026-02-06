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

function createSheetBook(presentNames) {
  const present = new Set(presentNames || []);
  return {
    getSheetByName: (name) => (present.has(name) ? { name } : null)
  };
}

function buildSandbox(options) {
  const nowMs = options && options.nowMs ? options.nowMs : Date.parse('2026-02-06T01:23:45.000Z');
  const props = createPropsStore((options && options.props) || {});
  const sheetBook = createSheetBook((options && options.presentSheets) || []);
  let exportCallCount = 0;
  const writeSummaryCalls = [];

  const sandbox = {
    console,
    Date: createFixedDate(nowMs),
    Session: {
      getScriptTimeZone: () => 'UTC'
    },
    Utilities: {
      formatDate: () => '20260206_012345'
    },
    SpreadsheetApp: {
      openById: () => sheetBook
    },
    belle_cfg_getProps_: () => props,
    belle_cfg_getSheetIdOrEmpty_: (inProps) => String(inProps.getProperty('BELLE_SHEET_ID') || ''),
    belle_exportYayoiCsv: () => {
      exportCallCount += 1;
      if (options && options.exportThrows === true) throw new Error('boom');
      return options && Object.prototype.hasOwnProperty.call(options, 'exportRes') ? options.exportRes : { ok: true, reason: 'OK' };
    },
    belle_ocr_getQueueSheetNameForDocType_: (_props, docType) => String(docType).toUpperCase() + '_QUEUE',
    belle_getSkipLogSheetName: () => 'EXPORT_SKIP_LOG',
    belle_getQueueSkipLogSheetName: () => 'QUEUE_SKIP_LOG',
    belle_getExportGuardLogSheetName: () => 'EXPORT_GUARD_LOG',
    BELLE_DOC_TYPE_RECEIPT: 'receipt',
    BELLE_DOC_TYPE_CC_STATEMENT: 'cc_statement',
    BELLE_DOC_TYPE_BANK_STATEMENT: 'bank_statement',
    DriveApp: {
      getFileById: () => ({
        getName: () => 'dummy.csv',
        makeCopy: () => ({ getId: () => 'copy-id' })
      })
    },
    belle_archive_getReportFolder_: () => ({ ok: true, folder: {}, path: '/reports' }),
    belle_archive_buildName_: () => 'report-name'
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('gas/ExportRunService.js', 'utf8'), sandbox);

  sandbox.belle_export_run_buildRunId_ = () => ((options && options.runId) || 'RUN_FIXED');
  sandbox.belle_export_run_collectCounts_ = () => ((options && options.countsRes) || {
    receipt: { queued: 0, done: 1, error: 0, retryable: 0, missing: false },
    cc_statement: { queued: 0, done: 0, error: 0, retryable: 0, missing: true },
    bank_statement: { queued: 0, done: 0, error: 0, retryable: 0, missing: true }
  });
  sandbox.belle_export_run_extractCsvFiles_ = () => ((options && options.csvFilesRes) || []);
  sandbox.belle_export_run_createReport_ = () => ((options && options.reportRes) || {
    ok: true,
    report_id: 'REPORT_1',
    report_name: 'report-name',
    folder_path: '/reports',
    run_id: 'RUN_FIXED'
  });
  sandbox.belle_export_run_clearSheet_ = (sh) => {
    if (options && typeof options.clearSheetImpl === 'function') return options.clearSheetImpl(sh);
    return sh ? { deleted: 1, missing: false } : { deleted: 0, missing: true };
  };
  sandbox.belle_export_run_writeSummary_ = (reportId, summary) => {
    writeSummaryCalls.push({ reportId, summary });
  };

  return {
    sandbox,
    getExportCallCount: () => exportCallCount,
    getWriteSummaryCalls: () => writeSummaryCalls
  };
}

function testMissingSheetIdFailure() {
  const ctx = buildSandbox({ props: {} });
  const res = ctx.sandbox.belle_export_run_maintenance_();
  expectEqual(res.ok, false, 'missing sheet id should fail');
  expectEqual(res.reason, 'MISSING_SHEET_ID', 'missing sheet id reason mismatch');
  expectEqual(res.message, 'Missing BELLE_SHEET_ID.', 'missing sheet id message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'missing sheet id should include data');
  expectEqual(res.data.run_id, 'RUN_FIXED', 'missing sheet id should include deterministic run id');
  expectEqual(ctx.getExportCallCount(), 0, 'export should not run when sheet id is missing');
}

function testExportExceptionFailure() {
  const ctx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    exportThrows: true
  });
  const res = ctx.sandbox.belle_export_run_maintenance_();
  expectEqual(res.ok, false, 'export exception should fail');
  expectEqual(res.reason, 'EXPORT_EXCEPTION', 'export exception reason mismatch');
  expectEqual(res.message, 'Export failed.', 'export exception message mismatch');
  expectEqual(res.data.run_id, 'RUN_FIXED', 'export exception should include run id');
}

function testExportBlockedMessages() {
  const guardCtx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    exportRes: {
      ok: false,
      phase: 'EXPORT_GUARD',
      reason: 'GUARD_BLOCK'
    }
  });
  const guardRes = guardCtx.sandbox.belle_export_run_maintenance_();
  expectEqual(guardRes.ok, false, 'guard block should fail');
  expectEqual(guardRes.reason, 'EXPORT_BLOCKED', 'guard block reason mismatch');
  expectEqual(guardRes.message, 'Export blocked: GUARD_BLOCK', 'guard block message mismatch');
  expect(typeof guardRes.data === 'object' && guardRes.data !== null, 'guard block should include data');
  expectEqual(guardRes.data.run_id, 'RUN_FIXED', 'guard block should include run id');
  expectEqual(guardRes.data.export.reason, 'GUARD_BLOCK', 'guard block should preserve export payload');

  const genericCtx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    exportRes: {
      ok: false,
      phase: 'EXPORT_ERROR',
      reason: 'WRITE_FAILED'
    }
  });
  const genericRes = genericCtx.sandbox.belle_export_run_maintenance_();
  expectEqual(genericRes.ok, false, 'generic block should fail');
  expectEqual(genericRes.reason, 'EXPORT_BLOCKED', 'generic block reason mismatch');
  expectEqual(genericRes.message, 'Export failed.', 'generic block message mismatch');
  expectEqual(genericRes.data.run_id, 'RUN_FIXED', 'generic block should include run id');
}

function testReportFailurePassthrough() {
  const reportReason = 'REPORT_STAGE_FAILED';
  const reportMessage = 'Summary sheet creation failed.';
  const ctx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    exportRes: {
      ok: true,
      phase: 'DONE',
      reason: 'OK'
    },
    reportRes: {
      ok: false,
      reason: reportReason,
      message: reportMessage
    }
  });
  const res = ctx.sandbox.belle_export_run_maintenance_();
  expectEqual(res.ok, false, 'report failure should fail overall');
  expectEqual(res.reason, reportReason, 'report failure reason should pass through');
  expectEqual(res.message, reportMessage, 'report failure message should pass through');
  expectEqual(res.data.run_id, 'RUN_FIXED', 'report failure should include run id');
  expect(typeof res.data.export === 'object' && res.data.export !== null, 'report failure should include export payload');
}

function testSuccessContract() {
  const exportRes = {
    ok: true,
    reason: 'OK',
    message: 'Export completed.',
    phase: 'DONE',
    csvFileId: 'csv_main'
  };
  const reportRes = {
    ok: true,
    report_id: 'REPORT_42',
    report_name: 'export_report',
    folder_path: '/reports/2026',
    run_id: 'RUN_FIXED'
  };
  const expectedClearKeys = [
    'RECEIPT_QUEUE',
    'CC_STATEMENT_QUEUE',
    'BANK_STATEMENT_QUEUE',
    'EXPORT_LOG',
    'EXPORT_SKIP_LOG',
    'QUEUE_SKIP_LOG',
    'EXPORT_GUARD_LOG'
  ];

  const ctx = buildSandbox({
    props: { BELLE_SHEET_ID: 'sheet-1' },
    exportRes,
    reportRes,
    presentSheets: expectedClearKeys,
    clearSheetImpl: (sh) => (sh ? { deleted: 2, missing: false } : { deleted: 0, missing: true }),
    csvFilesRes: [{ doc_type: 'receipt', file_id: 'csv_main', name: 'main.csv' }]
  });

  const res = ctx.sandbox.belle_export_run_maintenance_();
  expectEqual(res.ok, true, 'success path should be ok');
  expectEqual(res.reason, 'OK', 'success reason mismatch');
  expectEqual(res.message, 'Export run completed.', 'success message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'success should include data');
  expectEqual(res.data.run_id, 'RUN_FIXED', 'success should include run id');
  expect(res.data.report === reportRes, 'success should include report payload');
  expect(res.data.export === exportRes, 'success should include export payload');
  expect(typeof res.data.clear === 'object' && res.data.clear !== null, 'success should include clear payload');
  for (let i = 0; i < expectedClearKeys.length; i++) {
    const key = expectedClearKeys[i];
    expect(typeof res.data.clear[key] === 'object', 'clear should include key: ' + key);
  }
  expect(typeof res.data.timing_ms === 'object' && res.data.timing_ms !== null, 'success should include timing object');
  expectEqual(typeof res.data.timing_ms.total, 'number', 'timing total should be numeric');
  expectEqual(res.data.timing_ms.total, 0, 'timing total should be deterministic in fixed clock tests');

  const summaryCalls = ctx.getWriteSummaryCalls();
  expectEqual(summaryCalls.length, 1, 'summary writer should be called once');
  expectEqual(summaryCalls[0].reportId, 'REPORT_42', 'summary writer should receive report id');
  expectEqual(summaryCalls[0].summary.run_id, 'RUN_FIXED', 'summary payload should include run id');
  expect(Array.isArray(summaryCalls[0].summary.csv_files), 'summary payload should include csv files array');
}

testMissingSheetIdFailure();
testExportExceptionFailure();
testExportBlockedMessages();
testReportFailurePassthrough();
testSuccessContract();

console.log('OK: test_export_run_service_operational_paths');
