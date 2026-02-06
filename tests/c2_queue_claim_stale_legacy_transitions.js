const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config.js', 'utf8') + '\n'
  + fs.readFileSync('gas/DocTypeRegistry.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Log.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Sheet.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Drive.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Pdf.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Gemini.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Code.js', 'utf8') + '\n'
  + fs.readFileSync('gas/Queue.js', 'utf8');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function hasPhase(logs, phase) {
  for (let i = 0; i < logs.length; i++) {
    const row = logs[i];
    if (row && String(row.phase || '') === phase) return true;
  }
  return false;
}

class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowIdx = this.row - 1 + r;
      const row = this.sheet.data[rowIdx] || [];
      const vals = [];
      for (let c = 0; c < this.numCols; c++) {
        const colIdx = this.col - 1 + c;
        vals.push(row[colIdx] !== undefined ? row[colIdx] : '');
      }
      out.push(vals);
    }
    return out;
  }
  setValue(value) {
    const rowIdx = this.row - 1;
    const colIdx = this.col - 1;
    while (this.sheet.data.length <= rowIdx) this.sheet.data.push([]);
    while (this.sheet.data[rowIdx].length <= colIdx) this.sheet.data[rowIdx].push('');
    this.sheet.data[rowIdx][colIdx] = value;
    return this;
  }
  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIdx = this.row - 1 + r;
      while (this.sheet.data.length <= rowIdx) this.sheet.data.push([]);
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = this.col - 1 + c;
        while (this.sheet.data[rowIdx].length <= colIdx) this.sheet.data[rowIdx].push('');
        this.sheet.data[rowIdx][colIdx] = values[r][c];
      }
    }
    return this;
  }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
  }
  getLastRow() {
    return this.data.length;
  }
  getLastColumn() {
    return this.data[0] ? this.data[0].length : 0;
  }
  getRange(row, col, numRows, numCols) {
    return new MockRange(this, row, col, numRows, numCols);
  }
  appendRow(row) {
    this.data.push(row.slice());
    return this;
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {};
  }
  getSheetByName(name) {
    return this.sheets[name] || null;
  }
  insertSheet(name) {
    const sh = new MockSheet(name);
    this.sheets[name] = sh;
    return sh;
  }
}

function buildHeaderMap(header) {
  const out = {};
  for (let i = 0; i < header.length; i++) out[String(header[i])] = i;
  return out;
}

function buildRow(header, data) {
  const row = new Array(header.length);
  for (let i = 0; i < header.length; i++) {
    const key = header[i];
    row[i] = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : '';
  }
  return row;
}

const propStore = {
  BELLE_SHEET_ID: 'sheet-c2',
  BELLE_ACTIVE_DOC_TYPES: 'receipt',
  BELLE_OCR_MAX_ATTEMPTS: '3',
  BELLE_OCR_RETRY_BACKOFF_SECONDS: '300',
  BELLE_GEMINI_API_KEY: 'dummy-key',
  BELLE_GEMINI_MODEL: 'dummy-model'
};
const props = {
  getProperty: (k) => (Object.prototype.hasOwnProperty.call(propStore, k) ? propStore[k] : ''),
  setProperty: (k, v) => { propStore[k] = String(v); }
};

const logs = [];
let lockAvailable = true;
let lockReleased = 0;
const ss = new MockSpreadsheet();

sandbox.PropertiesService = {
  getScriptProperties: () => props
};
sandbox.SpreadsheetApp = {
  openById: () => ss
};
sandbox.Utilities = {
  getUuid: () => 'uuid-c2',
  sleep: () => {}
};
sandbox.Logger = {
  log: (entry) => logs.push(entry)
};
sandbox.LockService = {
  getScriptLock: () => ({
    tryLock: () => !!lockAvailable,
    waitLock: () => { if (!lockAvailable) throw new Error('lock busy'); },
    releaseLock: () => { lockReleased++; }
  })
};
sandbox.DriveApp = {
  getFileById: () => ({ getBlob: () => ({}) })
};

const queueSheetName = sandbox.belle_ocr_getQueueSheetNameForDocType_(props, 'receipt');
const header = sandbox.belle_getQueueHeader_();
const headerMap = buildHeaderMap(header);

function resetQueue(rows) {
  logs.length = 0;
  lockReleased = 0;
  lockAvailable = true;
  const sh = new MockSheet(queueSheetName);
  sh.appendRow(header);
  for (let i = 0; i < rows.length; i++) sh.appendRow(buildRow(header, rows[i]));
  ss.sheets[queueSheetName] = sh;
  return sh;
}

function testClaimStaleAndQueuedPriority() {
  const staleRow = {
    status: 'PROCESSING',
    file_id: 'stale-file',
    file_name: 'stale.png',
    mime_type: 'image/png',
    doc_type: 'receipt',
    ocr_lock_owner: 'worker-old',
    ocr_lock_until_iso: '1970-01-01T00:00:00.000Z',
    ocr_processing_started_at_iso: '1970-01-01T00:00:00.000Z'
  };
  const queuedRow = {
    status: 'QUEUED',
    file_id: 'queued-file',
    file_name: 'queued.png',
    mime_type: 'image/png',
    doc_type: 'receipt'
  };
  const sh = resetQueue([staleRow, queuedRow]);
  const res = sandbox.belle_ocr_claimNextRow_({
    docType: 'receipt',
    queueSheetName: queueSheetName,
    workerId: 'worker-new',
    ttlSeconds: 180,
    lockMode: 'try',
    lockWaitMs: 1
  });
  expect(res && res.claimed === true, 'claim should succeed');
  expect(res.statusBefore === 'QUEUED', 'claim should prioritize QUEUED');
  expect(res.file_id === 'queued-file', 'queued file should be claimed');
  expect(lockReleased === 1, 'lock should be released after claim');

  expect(sh.data[1][headerMap.status] === 'ERROR_RETRYABLE', 'stale row should move to ERROR_RETRYABLE');
  expect(sh.data[1][headerMap.ocr_error_code] === 'WORKER_STALE_LOCK', 'stale row error code mismatch');
  expect(String(sh.data[1][headerMap.ocr_error_detail] || '').indexOf('previous_owner') >= 0, 'stale detail should include previous_owner');
  expect(sh.data[1][headerMap.ocr_lock_owner] === '', 'stale lock owner should clear');
  expect(sh.data[1][headerMap.ocr_lock_until_iso] === '', 'stale lock until should clear');
  expect(sh.data[1][headerMap.ocr_processing_started_at_iso] === '', 'stale started_at should clear');
  expect(sh.data[1][headerMap.ocr_next_retry_at_iso] === '', 'stale retry should clear');

  expect(sh.data[2][headerMap.status] === 'PROCESSING', 'claimed row should be PROCESSING');
  expect(sh.data[2][headerMap.ocr_lock_owner] === 'worker-new', 'claimed row lock owner mismatch');
  expect(String(sh.data[2][headerMap.ocr_lock_until_iso] || '').length > 0, 'claimed row lock until missing');
  expect(String(sh.data[2][headerMap.ocr_processing_started_at_iso] || '').length > 0, 'claimed row started_at missing');

  expect(hasPhase(logs, 'OCR_REAP_STALE'), 'OCR_REAP_STALE phase missing');
  expect(hasPhase(logs, 'OCR_CLAIM'), 'OCR_CLAIM phase missing');
}

function testClaimReasons() {
  lockAvailable = false;
  logs.length = 0;
  const lockBusy = sandbox.belle_ocr_claimNextRow_({
    docType: 'receipt',
    queueSheetName: queueSheetName,
    lockMode: 'try',
    lockWaitMs: 1
  });
  expect(lockBusy && lockBusy.reason === 'LOCK_BUSY', 'LOCK_BUSY reason mismatch');

  resetQueue([]);
  const noRows = sandbox.belle_ocr_claimNextRow_({
    docType: 'receipt',
    queueSheetName: queueSheetName,
    lockMode: 'try',
    lockWaitMs: 1
  });
  expect(noRows && noRows.reason === 'NO_ROWS', 'NO_ROWS reason mismatch');

  resetQueue([{
    status: 'DONE',
    file_id: 'done-file',
    file_name: 'done.png',
    mime_type: 'image/png',
    doc_type: 'receipt'
  }, {
    status: 'ERROR_FINAL',
    file_id: 'final-file',
    file_name: 'final.png',
    mime_type: 'image/png',
    doc_type: 'receipt'
  }]);
  const noTarget = sandbox.belle_ocr_claimNextRow_({
    docType: 'receipt',
    queueSheetName: queueSheetName,
    lockMode: 'try',
    lockWaitMs: 1
  });
  expect(noTarget && noTarget.reason === 'NO_TARGET', 'NO_TARGET reason mismatch');
}

function testLegacyNormalizeObservability() {
  const sh = resetQueue([{
    status: 'ERROR_RETRYABLE',
    file_id: 'legacy-file',
    file_name: 'legacy.png',
    mime_type: 'image/png',
    doc_type: 'receipt',
    ocr_json: '{"legacy_error":"raw_json_in_error_state"}',
    ocr_error: '',
    ocr_attempts: '',
    ocr_last_attempt_at_iso: '',
    ocr_next_retry_at_iso: ''
  }]);
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  sandbox.belle_ocr_normalizeLegacyRows_(sh, values, headerMap, 300, 'receipt');

  expect(sh.data[1][headerMap.ocr_error_code] === 'LEGACY_ERROR_IN_OCR_JSON', 'legacy error code mismatch');
  expect(String(sh.data[1][headerMap.ocr_error_detail] || '').indexOf('legacy_error') >= 0, 'legacy detail should preserve source json');
  expect(String(sh.data[1][headerMap.ocr_error] || '').length > 0, 'legacy summary should be written');
  expect(sh.data[1][headerMap.ocr_json] === '', 'legacy ocr_json should clear');
  expect(Number(sh.data[1][headerMap.ocr_attempts]) === 1, 'legacy attempts should be initialized to 1');
  expect(String(sh.data[1][headerMap.ocr_last_attempt_at_iso] || '').length > 0, 'legacy last_attempt should be set');
  expect(String(sh.data[1][headerMap.ocr_next_retry_at_iso] || '').length > 0, 'legacy next_retry should be set');
  expect(hasPhase(logs, 'OCR_LEGACY_NORMALIZE'), 'OCR_LEGACY_NORMALIZE phase missing');
}

function testRunOnceDoneAndErrorPhases() {
  sandbox.belle_ocr_validateSchema = () => ({ ok: true });
  sandbox.belle_callGeminiOcr = () => '{"ok":true}';

  let sh = resetQueue([{
    status: 'QUEUED',
    file_id: 'done-path',
    file_name: 'done-path.png',
    mime_type: 'image/png',
    doc_type: 'receipt'
  }]);
  let res = sandbox.belle_processQueueOnceForDocType_(props, 'receipt', {});
  expect(res.processed === 1, 'done path should process 1 row');
  expect(res.errorsCount === 0, 'done path should have 0 errors');
  expect(sh.data[1][headerMap.status] === 'DONE', 'done path status should be DONE');
  expect(sh.data[1][headerMap.ocr_error_code] === '', 'done path error code should clear');
  expect(sh.data[1][headerMap.ocr_error_detail] === '', 'done path error detail should clear');
  expect(hasPhase(logs, 'OCR_ITEM_START'), 'OCR_ITEM_START phase missing on done path');
  expect(hasPhase(logs, 'OCR_ITEM_DONE'), 'OCR_ITEM_DONE phase missing');

  sandbox.belle_callGeminiOcr = () => { throw new Error('TRANSIENT_FAILURE'); };
  sandbox.belle_ocr_classifyError = () => ({ retryable: true, code: 'TRANSIENT_OCR' });
  sh = resetQueue([{
    status: 'QUEUED',
    file_id: 'error-path',
    file_name: 'error-path.png',
    mime_type: 'image/png',
    doc_type: 'receipt'
  }]);
  res = sandbox.belle_processQueueOnceForDocType_(props, 'receipt', {});
  expect(res.processed === 1, 'error path should process 1 row');
  expect(res.errorsCount === 1, 'error path should increment errorsCount');
  expect(sh.data[1][headerMap.status] === 'ERROR_RETRYABLE', 'error path status should be ERROR_RETRYABLE');
  expect(sh.data[1][headerMap.ocr_error_code] === 'TRANSIENT_OCR', 'error path error code mismatch');
  expect(String(sh.data[1][headerMap.ocr_error_detail] || '').indexOf('TRANSIENT_FAILURE') >= 0, 'error detail should include failure reason');
  expect(hasPhase(logs, 'OCR_ITEM_START'), 'OCR_ITEM_START phase missing on error path');
  expect(hasPhase(logs, 'OCR_ITEM_ERROR'), 'OCR_ITEM_ERROR phase missing');
}

testClaimStaleAndQueuedPriority();
testClaimReasons();
testLegacyNormalizeObservability();
testRunOnceDoneAndErrorPhases();

console.log('OK: c2_queue_claim_stale_legacy_transitions');
