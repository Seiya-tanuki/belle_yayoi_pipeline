const { expect, extractDashboardScript, createHarness } = require('./u1_dashboard_testkit');

function latestHistory(harness) {
  const items = harness.historyReactions();
  expect(items.length > 0, 'history should not be empty');
  return items[0];
}

const script = extractDashboardScript();
const levelMatches = Array.from(script.matchAll(/rx(?:SetCurrent|Push)\("([A-Z_]+)"/g)).map((m) => m[1]);
const uniqueLevels = Array.from(new Set(levelMatches));
const allowedLevels = new Set(['INFO', 'OK', 'WARN', 'ERROR']);
expect(uniqueLevels.length > 0, 'expected at least one reaction level usage');
uniqueLevels.forEach((level) => {
  expect(allowedLevels.has(level), 'unexpected reaction level detected: ' + level);
});

const harness = createHarness({
  bootHealth: { ok: true, data: { ready: true } }
});
harness.enqueueSuccess({ ok: true, data: { mode: 'OCR' } });
harness.enqueueSuccess({ ok: true, data: { running: false } });
harness.enqueueSuccess({ ok: true, data: { docTypes: [], totals: null } });
harness.enqueueSuccess({
  ok: true,
  data: {
    sheets: {
      exportGuard: { rows: [] },
      exportSkip: { rows: [] },
      queueSkip: { rows: [] }
    }
  }
});
harness.fireDOMContentLoaded();

harness.enqueueSuccess({ ok: true });
harness.enqueueSuccess({ ok: true, data: { docTypes: [], totals: null } });
harness.elements['btn-queue'].click();
{
  const item = latestHistory(harness);
  const current = harness.currentReaction();
  expect(item.level === 'OK', 'queue success should emit OK history entry');
  expect(current.level === 'OK', 'queue success should set current level to OK');
}

harness.enqueueSuccess({ ok: false, reason: 'OCR_ENABLE_BLOCKED', message: 'guarded' });
harness.elements['btn-ocr-enable'].click();
{
  const item = latestHistory(harness);
  const current = harness.currentReaction();
  expect(item.level === 'WARN', 'OCR_ENABLE_BLOCKED should emit WARN history entry');
  expect(current.level === 'WARN', 'OCR_ENABLE_BLOCKED should set current level to WARN');
}

const hooks = harness.hooks();
hooks.u1_render_modePanel_({ mode: 'MAINTENANCE', untilIso: '' });

harness.enqueueConfirm(true);
harness.enqueueFailure(new Error('transport failed'));
harness.elements['btn-archive-logs'].click();
{
  const item = latestHistory(harness);
  const current = harness.currentReaction();
  expect(item.level === 'ERROR', 'archive logs failure should emit ERROR history entry');
  expect(current.level === 'ERROR', 'archive logs failure should set current level to ERROR');
}

const historyLevels = harness.historyReactions().map((r) => r.level);
historyLevels.forEach((level) => {
  expect(allowedLevels.has(level), 'history emitted unexpected level: ' + level);
});

console.log('OK: u1_dashboard_observability_continuity');
