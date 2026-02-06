const { expect, createHarness } = require('./u1_dashboard_testkit');

function latestHistory(harness) {
  const items = harness.historyReactions();
  expect(items.length > 0, 'history should not be empty');
  return items[0];
}

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

expect(harness.elements['setup-view'].classList.contains('hidden'), 'setup view should be hidden after ready boot');
expect(!harness.elements['dashboard-view'].classList.contains('hidden'), 'dashboard view should be visible after ready boot');

const hooks = harness.hooks();
hooks.applyHealthResult({
  message: 'Environment not ready.',
  data: { ready: false, diagnostics: [] }
});
expect(!harness.elements['setup-view'].classList.contains('hidden'), 'setup view should be visible when not ready');
expect(harness.elements['dashboard-view'].classList.contains('hidden'), 'dashboard view should be hidden when not ready');

hooks.applyHealthResult({ data: { ready: true } });
expect(harness.elements['setup-view'].classList.contains('hidden'), 'setup view should return hidden when ready');
expect(!harness.elements['dashboard-view'].classList.contains('hidden'), 'dashboard view should return visible when ready');

hooks.u1_render_modePanel_({ mode: 'OCR', untilIso: '' });
expect(harness.elements['btn-queue'].disabled === false, 'queue should be enabled in OCR mode');
expect(harness.elements['btn-ocr-enable'].disabled === false, 'OCR enable should be enabled in OCR mode');
expect(harness.elements['btn-ocr-disable'].disabled === false, 'OCR disable should be enabled in OCR mode');
expect(harness.elements['btn-export-run'].disabled === true, 'export run should be disabled in OCR mode');
expect(harness.elements['btn-archive-images'].disabled === true, 'archive images should be disabled in OCR mode');
expect(harness.elements['btn-archive-logs'].disabled === true, 'archive logs should be disabled in OCR mode');

hooks.u1_render_modePanel_({ mode: 'MAINTENANCE', untilIso: '2026-02-06T00:00:00Z' });
expect(harness.elements['btn-queue'].disabled === true, 'queue should be disabled in MAINTENANCE mode');
expect(harness.elements['btn-ocr-enable'].disabled === true, 'OCR enable should be disabled in MAINTENANCE mode');
expect(harness.elements['btn-ocr-disable'].disabled === true, 'OCR disable should be disabled in MAINTENANCE mode');
expect(harness.elements['btn-export-run'].disabled === false, 'export run should be enabled in MAINTENANCE mode');
expect(harness.elements['btn-archive-images'].disabled === false, 'archive images should be enabled in MAINTENANCE mode');
expect(harness.elements['btn-archive-logs'].disabled === false, 'archive logs should be enabled in MAINTENANCE mode');

hooks.u1_render_modePanel_({ mode: 'OCR', untilIso: '' });

harness.enqueueSuccess({ ok: true });
harness.enqueueSuccess({ ok: true, data: { docTypes: [], totals: null } });
harness.elements['btn-queue'].click();
{
  const item = latestHistory(harness);
  expect(item.level === 'OK', 'queue success should push OK');
  expect(item.text.indexOf('Queue completed.') >= 0, 'queue success message should be preserved');
}

harness.enqueueConfirm(true);
harness.enqueueSuccess({ ok: false, reason: 'TRIGGERS_ACTIVE', message: 'triggers active' });
harness.elements['btn-change-mode'].click();
{
  const item = latestHistory(harness);
  expect(item.level === 'WARN', 'TRIGGERS_ACTIVE should push WARN');
  expect(item.text.indexOf('Disable OCR triggers before entering maintenance.') >= 0, 'TRIGGERS_ACTIVE warn text should be preserved');
}

harness.enqueueConfirm(true);
harness.enqueueSuccess({ ok: false, reason: 'LIVE_PROCESSING', message: 'live processing' });
harness.elements['btn-change-mode'].click();
{
  const item = latestHistory(harness);
  expect(item.level === 'WARN', 'LIVE_PROCESSING should push WARN');
  expect(item.text.indexOf('Processing still active.') >= 0, 'LIVE_PROCESSING warn text should be preserved');
}

harness.enqueueSuccess({ ok: false, reason: 'OCR_ENABLE_BLOCKED', message: 'blocked by guard' });
harness.elements['btn-ocr-enable'].click();
{
  const item = latestHistory(harness);
  expect(item.level === 'WARN', 'OCR_ENABLE_BLOCKED should push WARN');
  expect(item.text.indexOf('blocked: blocked by guard') >= 0, 'OCR_ENABLE_BLOCKED blocked message should be preserved');
}

hooks.u1_render_modePanel_({ mode: 'MAINTENANCE', untilIso: '' });

harness.enqueueConfirm(true);
harness.enqueueSuccess({ ok: true });
harness.elements['btn-export-run'].click();
{
  const item = latestHistory(harness);
  expect(item.level === 'OK', 'export success should push OK');
  expect(item.text.indexOf('Export run completed.') >= 0, 'export success text should be preserved');
}

harness.enqueueConfirm(true);
harness.enqueueFailure(new Error('network down'));
harness.elements['btn-archive-logs'].click();
{
  const item = latestHistory(harness);
  expect(item.level === 'ERROR', 'archive logs transport failure should push ERROR');
  expect(item.text.indexOf('Archive logs failed.') >= 0, 'archive logs error text should be preserved');
}

harness.enqueueSuccess({ ok: true, data: { moved_total: 0, remaining: false } });
harness.elements['btn-archive-images'].click();
{
  const item = latestHistory(harness);
  expect(item.level === 'OK', 'archive images success should push OK');
  expect(item.text.indexOf('Archived 0 images. Nothing to archive.') >= 0, 'archive images completion text should be preserved');
}

console.log('OK: u1_dashboard_ui_flow_parity');
