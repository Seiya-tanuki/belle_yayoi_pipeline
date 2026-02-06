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
    },
    dump: () => Object.assign({}, store)
  };
}

function buildSandbox(options) {
  const nowMs = options && options.nowMs ? options.nowMs : Date.parse('2026-02-06T00:00:00.000Z');
  const props = createPropsStore((options && options.props) || {});
  let lockReleaseCount = 0;

  const sandbox = {
    console,
    Date: createFixedDate(nowMs),
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          if (options && options.lockBusy === true) throw new Error('busy');
        },
        releaseLock: () => {
          lockReleaseCount += 1;
        }
      })
    },
    ScriptApp: {
      getProjectTriggers: () => ((options && options.triggers) || [])
    },
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => null
      })
    },
    belle_cfg_getProps_: () => props,
    belle_cfg_getSheetIdOrEmpty_: (inProps) => String(inProps.getProperty('BELLE_SHEET_ID') || ''),
    belle_ocr_getQueueSheetNameForDocType_: (_props, docType) => String(docType),
    BELLE_DOC_TYPE_RECEIPT: 'receipt',
    BELLE_DOC_TYPE_CC_STATEMENT: 'cc_statement',
    BELLE_DOC_TYPE_BANK_STATEMENT: 'bank_statement'
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('gas/MaintenanceMode.js', 'utf8'), sandbox);
  return {
    sandbox,
    props,
    getLockReleaseCount: () => lockReleaseCount,
    nowMs
  };
}

function testRequireModePaths() {
  const ctx = buildSandbox({ props: {} });
  const mismatch = ctx.sandbox.belle_maint_requireMode_('MAINTENANCE');
  expectEqual(mismatch.ok, false, 'requireMode mismatch should fail');
  expectEqual(mismatch.reason, 'MODE_NOT_MAINTENANCE', 'reason mismatch for maintenance mismatch');
  expectEqual(mismatch.message, 'Mode must be MAINTENANCE.', 'message mismatch for maintenance mismatch');
  expectEqual(mismatch.data.mode, 'OCR', 'mismatch mode should report OCR');
  expect(typeof mismatch.data === 'object' && mismatch.data !== null, 'mismatch should return data object');

  const matchedOcr = ctx.sandbox.belle_maint_requireMode_('OCR');
  expectEqual(matchedOcr.ok, true, 'requireMode OCR should pass');
  expectEqual(matchedOcr.reason, 'OK', 'requireMode OCR reason should be OK');
  expectEqual(matchedOcr.message, 'OK', 'requireMode OCR message should be OK');
  expectEqual(matchedOcr.data.mode, 'OCR', 'requireMode OCR should return OCR mode');

  const futureIso = new Date(ctx.nowMs + 600000).toISOString();
  ctx.sandbox.belle_maint_setMode_('MAINTENANCE', futureIso);
  const matchedMaintenance = ctx.sandbox.belle_maint_requireMode_('MAINTENANCE');
  expectEqual(matchedMaintenance.ok, true, 'requireMode maintenance should pass when maintenance is active');
  expectEqual(matchedMaintenance.reason, 'OK', 'maintenance match reason should be OK');
  expectEqual(matchedMaintenance.message, 'OK', 'maintenance match message should be OK');
  expectEqual(matchedMaintenance.data.mode, 'MAINTENANCE', 'maintenance match mode should be MAINTENANCE');
  expectEqual(matchedMaintenance.data.until_iso, futureIso, 'maintenance match should include until_iso');
}

function testQuiesceFailurePaths() {
  const nowMs = Date.parse('2026-02-06T00:00:00.000Z');

  const already = buildSandbox({
    nowMs,
    props: {
      BELLE_DASHBOARD_MODE: 'MAINTENANCE',
      BELLE_DASHBOARD_MAINT_UNTIL_ISO: new Date(nowMs + 600000).toISOString()
    }
  });
  const alreadyRes = already.sandbox.belle_maint_quiesceAndEnter_();
  expectEqual(alreadyRes.ok, false, 'already maintenance should fail');
  expectEqual(alreadyRes.reason, 'ALREADY_MAINTENANCE', 'already maintenance reason mismatch');
  expectEqual(alreadyRes.message, 'Already in maintenance mode.', 'already maintenance message mismatch');
  expect(typeof alreadyRes.data === 'object' && alreadyRes.data !== null, 'already maintenance should include data');

  const lockBusy = buildSandbox({ nowMs, props: {}, lockBusy: true });
  const lockBusyRes = lockBusy.sandbox.belle_maint_quiesceAndEnter_();
  expectEqual(lockBusyRes.ok, false, 'lock busy should fail');
  expectEqual(lockBusyRes.reason, 'LOCK_BUSY', 'lock busy reason mismatch');
  expectEqual(lockBusyRes.message, 'Script lock busy.', 'lock busy message mismatch');
  expectEqual(lockBusyRes.data, null, 'lock busy should return null data');

  const triggersActive = buildSandbox({
    nowMs,
    props: {},
    triggers: [{ getHandlerFunction: () => 'belle_ocr_workerTick' }]
  });
  const triggerRes = triggersActive.sandbox.belle_maint_quiesceAndEnter_();
  expectEqual(triggerRes.ok, false, 'triggers active should fail');
  expectEqual(triggerRes.reason, 'TRIGGERS_ACTIVE', 'triggers active reason mismatch');
  expectEqual(triggerRes.message, 'Disable OCR triggers before entering maintenance.', 'triggers active message mismatch');
  expect(typeof triggerRes.data === 'object' && triggerRes.data !== null, 'triggers active should include data');
  expectEqual(triggersActive.getLockReleaseCount(), 1, 'lock should be released when triggers are active');

  const propagatedLiveCheck = buildSandbox({ nowMs, props: {} });
  propagatedLiveCheck.sandbox.belle_maint_hasOcrTriggers_ = () => false;
  propagatedLiveCheck.sandbox.belle_maint_checkNoLiveProcessing_ = () => ({
    ok: false,
    reason: 'LIVE_PROCESSING',
    message: 'Processing still active.',
    data: { sheet: 'OCR_RECEIPT' }
  });
  const liveRes = propagatedLiveCheck.sandbox.belle_maint_quiesceAndEnter_();
  expectEqual(liveRes.ok, false, 'live processing should fail');
  expectEqual(liveRes.reason, 'LIVE_PROCESSING', 'live processing reason should pass through');
  expectEqual(liveRes.message, 'Processing still active.', 'live processing message should pass through');
  expectEqual(liveRes.data.sheet, 'OCR_RECEIPT', 'live processing data should pass through');
  expectEqual(propagatedLiveCheck.getLockReleaseCount(), 1, 'lock should be released when live check fails');
}

function testQuiesceSuccessAndExit() {
  const nowMs = Date.parse('2026-02-06T00:00:00.000Z');
  const ttlMinutes = 15;
  const ctx = buildSandbox({
    nowMs,
    props: {
      BELLE_MAINTENANCE_TTL_MINUTES: String(ttlMinutes)
    }
  });

  ctx.sandbox.belle_maint_hasOcrTriggers_ = () => false;
  ctx.sandbox.belle_maint_checkNoLiveProcessing_ = () => ({ ok: true, reason: 'OK', message: 'No live processing.', data: null });

  const enterRes = ctx.sandbox.belle_maint_quiesceAndEnter_();
  const expectedUntil = new Date(nowMs + ttlMinutes * 60000).toISOString();
  expectEqual(enterRes.ok, true, 'quiesce success should be ok');
  expectEqual(enterRes.reason, 'OK', 'quiesce success reason mismatch');
  expectEqual(enterRes.message, 'Maintenance mode enabled.', 'quiesce success message mismatch');
  expectEqual(enterRes.data.mode, 'MAINTENANCE', 'quiesce success mode mismatch');
  expectEqual(enterRes.data.ttl_minutes, ttlMinutes, 'quiesce success ttl mismatch');
  expectEqual(enterRes.data.until_iso, expectedUntil, 'quiesce success until mismatch');
  expectEqual(ctx.getLockReleaseCount(), 1, 'lock should be released on success');

  const stateAfterEnter = ctx.sandbox.belle_maint_getState_();
  expectEqual(stateAfterEnter.mode, 'MAINTENANCE', 'state should be maintenance after enter');
  expectEqual(stateAfterEnter.untilIso, expectedUntil, 'state should keep expected until');

  const exitRes = ctx.sandbox.belle_maint_exit_();
  expectEqual(exitRes.ok, true, 'exit should succeed');
  expectEqual(exitRes.reason, 'OK', 'exit reason mismatch');
  expectEqual(exitRes.message, 'Maintenance mode disabled.', 'exit message mismatch');
  expectEqual(exitRes.data.mode, 'OCR', 'exit mode mismatch');
  expectEqual(exitRes.data.until_iso, '', 'exit until should be cleared');

  const stateAfterExit = ctx.sandbox.belle_maint_getState_();
  expectEqual(stateAfterExit.mode, 'OCR', 'state should return to OCR after exit');
  expectEqual(stateAfterExit.untilIso, '', 'state should clear until after exit');
}

testRequireModePaths();
testQuiesceFailurePaths();
testQuiesceSuccessAndExit();

console.log('OK: test_maintenance_mode_operational_paths');
