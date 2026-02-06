const { expect, createHarness } = require('./u1_dashboard_testkit');

const harness = createHarness({ bootHealth: null });
const hooks = harness.hooks();

expect(hooks && typeof hooks.u1_transport_callServer_ === 'function', 'u1_transport_callServer_ hook missing');

let successErr = null;
let successRes = null;
harness.enqueueSuccess({ ok: true, data: { value: 1 } });
hooks.u1_transport_callServer_('belle_dash_getOverview', undefined, (err, res) => {
  successErr = err;
  successRes = res;
});

expect(successErr === null, 'success path should pass null error');
expect(successRes && successRes.ok === true, 'success path should return response');
expect(harness.calls.length === 1, 'expected one call after no-payload invocation');
expect(harness.calls[0].fnName === 'belle_dash_getOverview', 'unexpected fnName for no-payload invocation');
expect(harness.calls[0].argsLength === 0, 'no-payload invocation must call server function with zero args');

let payloadErr = null;
let payloadRes = null;
const payload = { mode: 'OCR' };
harness.enqueueSuccess({ ok: true, data: { mode: 'OCR' } });
hooks.u1_transport_callServer_('belle_dash_getMode', payload, (err, res) => {
  payloadErr = err;
  payloadRes = res;
});

expect(payloadErr === null, 'payload success path should pass null error');
expect(payloadRes && payloadRes.ok === true, 'payload success path should return response');
expect(harness.calls.length === 2, 'expected second call after payload invocation');
expect(harness.calls[1].fnName === 'belle_dash_getMode', 'unexpected fnName for payload invocation');
expect(harness.calls[1].argsLength === 1, 'payload invocation must call server function with one arg');
expect(harness.calls[1].payload === payload, 'payload object identity should be preserved');

let failureErr = null;
let failureRes = null;
harness.enqueueFailure(new Error('transport failed'));
hooks.u1_transport_callServer_('belle_dash_getLogs', undefined, (err, res) => {
  failureErr = err;
  failureRes = res;
});

expect(!!failureErr, 'failure path should provide error');
expect(failureRes === null, 'failure path should pass null response');
expect(harness.calls.length === 3, 'expected third call after failure invocation');
expect(harness.calls[2].fnName === 'belle_dash_getLogs', 'unexpected fnName for failure invocation');
expect(harness.calls[2].argsLength === 0, 'failure no-payload invocation must call server function with zero args');

console.log('OK: u1_dashboard_transport_contracts');
