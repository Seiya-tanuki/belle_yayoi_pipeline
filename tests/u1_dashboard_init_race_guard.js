const { expect, createHarness } = require('./u1_dashboard_testkit');

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

expect(harness.calls.length === 4, 'initial dashboard boot should make exactly 4 requests');

const hooks = harness.hooks();
hooks.applyHealthResult({
  message: 'Environment not ready.',
  data: { ready: false, diagnostics: [] }
});
hooks.applyHealthResult({ data: { ready: true } });
hooks.applyHealthResult({ data: { ready: true } });

expect(harness.calls.length === 4, 're-applying health should not trigger re-initialization requests');

harness.enqueueSuccess({ ok: true, data: { docTypes: [], totals: null } });
harness.elements['btn-refresh-overview'].click();

const overviewCalls = harness.calls.filter((c) => c.fnName === 'belle_dash_getOverview');
expect(overviewCalls.length === 2, 'refresh overview should be wired once (1 boot + 1 click)');

console.log('OK: u1_dashboard_init_race_guard');
