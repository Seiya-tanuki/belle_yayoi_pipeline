const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8') + '\n' + fs.readFileSync('gas/Code.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const compute = sandbox.belle_ocr_computeGeminiTemperatureWithConfig_;
expect(typeof compute === 'function', 'compute helper should exist');

function calc(ctx) {
  return compute(ctx, { defaultRaw: '0', addRaw: '1' });
}

const resQueued = calc({
  attempt: 1,
  maxAttempts: 3,
  statusBefore: 'QUEUED',
  prevErrorCode: '',
  prevError: '',
  prevErrorDetail: ''
});
expect(resQueued.temperature === 0 && resQueued.overridden === false, 'queued should use default');

const resFinalInvalid = calc({
  attempt: 3,
  maxAttempts: 3,
  statusBefore: 'ERROR_RETRYABLE',
  prevErrorCode: 'INVALID_SCHEMA',
  prevError: '',
  prevErrorDetail: ''
});
expect(resFinalInvalid.temperature === 1 && resFinalInvalid.overridden === true, 'final invalid schema should add temp');

const resFinal503 = calc({
  attempt: 3,
  maxAttempts: 3,
  statusBefore: 'ERROR_RETRYABLE',
  prevErrorCode: 'INVALID_SCHEMA',
  prevError: 'Gemini HTTP 503: overload',
  prevErrorDetail: ''
});
expect(resFinal503.temperature === 0 && resFinal503.overridden === false, '503 should not add temp');

const resNotFinal = calc({
  attempt: 2,
  maxAttempts: 3,
  statusBefore: 'ERROR_RETRYABLE',
  prevErrorCode: 'INVALID_SCHEMA',
  prevError: '',
  prevErrorDetail: ''
});
expect(resNotFinal.temperature === 0 && resNotFinal.overridden === false, 'non-final retry should use default');

console.log('OK: test_ocr_temperature_policy');
