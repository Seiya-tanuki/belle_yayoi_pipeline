const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const headerKeys = [
  'file_id',
  'file_name',
  'mime_type',
  'status',
  'doc_type',
  'ocr_json',
  'ocr_error',
  'ocr_error_code',
  'ocr_error_detail',
  'ocr_attempts',
  'ocr_last_attempt_at_iso',
  'ocr_lock_owner',
  'ocr_lock_until_iso',
  'ocr_processing_started_at_iso',
  'ocr_next_retry_at_iso'
];

function makeHeaderMap() {
  const map = {};
  for (let i = 0; i < headerKeys.length; i++) {
    map[headerKeys[i]] = i;
  }
  return map;
}

function makeBaseRow() {
  return {
    file_id: 'FILE-1',
    file_name: 'a.pdf',
    mime_type: 'application/pdf',
    status: 'PROCESSING',
    doc_type: 'receipt',
    ocr_json: '',
    ocr_error: '',
    ocr_error_code: '',
    ocr_error_detail: '',
    ocr_attempts: 0,
    ocr_last_attempt_at_iso: '',
    ocr_lock_owner: 'W1',
    ocr_lock_until_iso: '2099-01-01T00:00:00.000Z',
    ocr_processing_started_at_iso: '2099-01-01T00:00:00.000Z',
    ocr_next_retry_at_iso: ''
  };
}

function createSheetHarness(rowObj, onFullRead) {
  const headerMap = makeHeaderMap();
  const row = headerKeys.map((k) => (rowObj[k] !== undefined ? rowObj[k] : ''));
  const state = { row, fullReadCount: 0 };
  const sheet = {
    getLastColumn: () => headerKeys.length,
    getRange: (rowIndex, col, numRows, numCols) => {
      if (rowIndex !== 2) throw new Error('unexpected rowIndex: ' + rowIndex);
      if (col === 1 && numRows === 1 && numCols === headerKeys.length) {
        return {
          getValues: () => {
            state.fullReadCount += 1;
            if (typeof onFullRead === 'function') onFullRead(state.fullReadCount, state.row, headerMap);
            return [state.row.slice()];
          }
        };
      }
      return {
        setValue: (value) => {
          state.row[col - 1] = value;
        }
      };
    }
  };
  return { sheet, headerMap, state };
}

function getCell(state, headerMap, key) {
  return state.row[headerMap[key]];
}

function runScenario(cfg) {
  const code = fs.readFileSync('gas/OcrWorkerParallel.js', 'utf8');
  const rowObj = Object.assign(makeBaseRow(), cfg.row || {});
  const harness = createSheetHarness(rowObj, cfg.onFullRead);
  const logs = [];
  const propsValues = Object.assign({
    BELLE_OCR_LOCK_TTL_SECONDS: '60',
    BELLE_OCR_MAX_ATTEMPTS: '3',
    BELLE_OCR_RETRY_BACKOFF_SECONDS: '300'
  }, cfg.props || {});

  const sandbox = {
    console,
    Logger: { log: (x) => logs.push(x) },
    BELLE_DOC_PIPELINE_TWO_STAGE: 'two_stage',
    BELLE_DOC_PIPELINE_INACTIVE: 'inactive',
    Utilities: { getUuid: () => 'AUTO-WORKER-ID' },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {},
        releaseLock: () => {}
      })
    },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => harness.sheet
      })
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  sandbox.belle_cfg_getProps_ = () => ({
    getProperty: (key) => propsValues[key] || ''
  });
  sandbox.belle_ocr_getActiveDocTypes_ = () => ['receipt'];
  sandbox.belle_docType_getSpec_ = (docType) => {
    if (docType === 'inactive_doc') return { pipeline_kind: 'inactive', ocr_run_once_fn: '' };
    const pipelineKind = cfg.pipelineKind || 'single_stage';
    return { pipeline_kind: pipelineKind, ocr_run_once_fn: 'mockRunOnce' };
  };
  sandbox.belle_ocr_worker_resolveTtlSeconds_ = () => 60;
  sandbox.belle_ocr_claimNextRowByDocTypes_ = () => Object.assign({
    claimed: true,
    rowIndex: 2,
    queueSheetName: 'QUEUE',
    statusBefore: 'OCR_PENDING',
    docType: 'receipt',
    processingCount: 5
  }, cfg.claim || {});
  sandbox.belle_cfg_getSheetIdOrThrow_ = () => 'SHEET-ID';
  sandbox.belle_getQueueSheetName = () => 'QUEUE';
  sandbox.belle_getQueueHeaderColumns = () => ['file_id'];
  sandbox.belle_getQueueLockHeaderColumns_ = () => ['ocr_lock_owner'];
  sandbox.belle_queue_ensureHeaderMapCanonical_ = () => harness.headerMap;
  sandbox.belle_ocr_getRunOnceFnNameForDocType_ = () => 'mockRunOnce';
  sandbox.mockRunOnce = cfg.runOnce || (() => ({ statusOut: 'DONE', outcome: 'DONE', jsonStr: '{"ok":true}' }));
  sandbox.belle_ocr_classifyError = cfg.classifyError || (() => ({ retryable: false, code: 'UNKNOWN' }));
  sandbox.belle_ocr_extractHttpStatus_ = cfg.extractHttpStatus || (() => 0);
  sandbox.belle_ocr_worker_calcBackoffMs_ = cfg.calcBackoffMs || (() => 1000);
  sandbox.belle_ocr_buildInvalidSchemaLogDetail_ = (json) => 'INVALID_SCHEMA:' + json;

  const result = sandbox.belle_ocr_workerOnce_({ workerId: 'W1', docTypes: ['receipt'] });
  return { result, harness, logs };
}

{
  const s = runScenario({
    onFullRead: (n, row, map) => {
      if (n === 2) {
        row[map.ocr_lock_owner] = 'OTHER';
      }
    },
    runOnce: () => {
      throw new Error('runOnce should not execute for pre-dispatch CLAIM_LOST');
    }
  });
  expect(s.result.processed === 0, 'pre-dispatch claim-lost: processed');
  expect(s.result.reason === 'CLAIM_LOST', 'pre-dispatch claim-lost: reason');
  expect(s.result.classify === '', 'pre-dispatch claim-lost: classify should stay empty');
}

{
  const s = runScenario({
    onFullRead: (n, row, map) => {
      if (n === 3) {
        row[map.ocr_lock_owner] = 'OTHER';
      }
    },
    runOnce: () => ({
      statusOut: 'DONE',
      outcome: 'DONE',
      jsonStr: '{"done":1}',
      geminiElapsedMs: 77,
      httpStatus: 200
    })
  });
  expect(s.result.processed === 0, 'pre-commit claim-lost: processed');
  expect(s.result.reason === 'CLAIM_LOST', 'pre-commit claim-lost: reason');
  expect(s.result.classify === 'DONE', 'pre-commit claim-lost: classify');
  expect(s.result.geminiElapsedMs === 77, 'pre-commit claim-lost: geminiElapsedMs');
}

{
  const s = runScenario({
    row: {
      ocr_error: 'old-error',
      ocr_error_code: 'old-code',
      ocr_error_detail: 'old-detail',
      ocr_next_retry_at_iso: '2099-02-02T00:00:00.000Z'
    },
    runOnce: () => ({
      statusOut: 'DONE',
      outcome: 'DONE',
      jsonStr: '{"new":"done"}'
    })
  });
  const map = s.harness.headerMap;
  expect(getCell(s.harness.state, map, 'status') === 'DONE', 'DONE writeback: status');
  expect(getCell(s.harness.state, map, 'ocr_json') === '{"new":"done"}', 'DONE writeback: json');
  expect(getCell(s.harness.state, map, 'ocr_error') === '', 'DONE writeback: ocr_error clear');
  expect(getCell(s.harness.state, map, 'ocr_error_code') === '', 'DONE writeback: ocr_error_code clear');
  expect(getCell(s.harness.state, map, 'ocr_error_detail') === '', 'DONE writeback: ocr_error_detail clear');
  expect(getCell(s.harness.state, map, 'ocr_next_retry_at_iso') === '', 'DONE writeback: next_retry clear');
}

{
  const s = runScenario({
    row: {
      ocr_error: 'old-error',
      ocr_error_code: 'old-code',
      ocr_error_detail: 'old-detail',
      ocr_next_retry_at_iso: '2099-02-02T00:00:00.000Z'
    },
    runOnce: () => ({
      statusOut: 'QUEUED',
      outcome: 'QUEUED',
      jsonStr: '{"new":"queued"}'
    })
  });
  const map = s.harness.headerMap;
  expect(getCell(s.harness.state, map, 'status') === 'QUEUED', 'QUEUED writeback: status');
  expect(getCell(s.harness.state, map, 'ocr_json') === '{"new":"queued"}', 'QUEUED writeback: json');
  expect(getCell(s.harness.state, map, 'ocr_error') === '', 'QUEUED writeback: ocr_error clear');
  expect(getCell(s.harness.state, map, 'ocr_error_code') === '', 'QUEUED writeback: ocr_error_code clear');
  expect(getCell(s.harness.state, map, 'ocr_error_detail') === '', 'QUEUED writeback: ocr_error_detail clear');
  expect(getCell(s.harness.state, map, 'ocr_next_retry_at_iso') === '', 'QUEUED writeback: next_retry clear');
}

{
  const s = runScenario({
    row: { ocr_json: '{"old":"value"}' },
    runOnce: () => {
      throw new Error('temporary 503');
    },
    classifyError: () => ({ retryable: true, code: 'HTTP_503' }),
    extractHttpStatus: () => 503,
    calcBackoffMs: () => 60000
  });
  const map = s.harness.headerMap;
  expect(getCell(s.harness.state, map, 'status') === 'ERROR_RETRYABLE', 'retryable writeback: status');
  expect(getCell(s.harness.state, map, 'ocr_error_code') === 'HTTP_503', 'retryable writeback: error_code');
  expect(getCell(s.harness.state, map, 'ocr_error_detail').indexOf('temporary 503') >= 0, 'retryable writeback: error_detail');
  expect(getCell(s.harness.state, map, 'ocr_next_retry_at_iso') !== '', 'retryable writeback: next_retry set');
  expect(getCell(s.harness.state, map, 'ocr_json') === '', 'retryable writeback: json cleared');
}

{
  const s = runScenario({
    row: { ocr_json: 'persist-json' },
    runOnce: () => ({
      statusOut: 'ERROR_FINAL',
      outcome: 'ERROR_FINAL',
      errorCode: 'FINAL_CODE',
      errorMessage: 'final-message',
      errorDetail: 'final-detail',
      keepOcrJsonOnError: true,
      nextRetryIso: ''
    })
  });
  const map = s.harness.headerMap;
  expect(getCell(s.harness.state, map, 'status') === 'ERROR_FINAL', 'final writeback: status');
  expect(getCell(s.harness.state, map, 'ocr_error_code') === 'FINAL_CODE', 'final writeback: error_code');
  expect(getCell(s.harness.state, map, 'ocr_error_detail') === 'final-detail', 'final writeback: error_detail');
  expect(getCell(s.harness.state, map, 'ocr_next_retry_at_iso') === '', 'final writeback: next_retry empty');
  expect(getCell(s.harness.state, map, 'ocr_json') === 'persist-json', 'final writeback: json preserved');
}

{
  const s = runScenario({
    row: {
      ocr_json: 'legacy-json-payload',
      ocr_error: '',
      ocr_attempts: 2
    },
    claim: { statusBefore: 'ERROR_RETRYABLE' },
    onFullRead: (n, row, map) => {
      if (n === 3) {
        row[map.ocr_lock_owner] = 'OTHER';
      }
    },
    runOnce: () => ({
      statusOut: 'DONE',
      outcome: 'DONE',
      jsonStr: '{"ignored":"because-claim-lost"}'
    })
  });
  const map = s.harness.headerMap;
  expect(s.result.reason === 'CLAIM_LOST', 'legacy normalization: should exit via claim-lost');
  expect(getCell(s.harness.state, map, 'ocr_error_code') === 'LEGACY_ERROR_IN_OCR_JSON', 'legacy normalization: error_code');
  expect(getCell(s.harness.state, map, 'ocr_error_detail').indexOf('legacy-json-payload') >= 0, 'legacy normalization: error_detail');
  expect(getCell(s.harness.state, map, 'ocr_json') === '', 'legacy normalization: json cleared');
  expect(Number(getCell(s.harness.state, map, 'ocr_attempts')) === 3, 'legacy normalization: attempt increment');
  expect(String(getCell(s.harness.state, map, 'ocr_last_attempt_at_iso')).indexOf('T') > 0, 'legacy normalization: last_attempt timestamp');
}

console.log('OK: c3_ocr_worker_state_transitions');
