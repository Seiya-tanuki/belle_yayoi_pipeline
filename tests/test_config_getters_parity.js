const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/Config_v0.js', 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function expectThrows(fn, msg) {
  let threw = false;
  let err = null;
  try {
    fn();
  } catch (e) {
    threw = true;
    err = e;
  }
  if (!threw) throw new Error(msg);
  return err;
}

const props = {
  store: {},
  getProperty(key) {
    return this.store[key];
  }
};

// String required.
{
  const err = expectThrows(() => sandbox.belle_cfg_getString_(props, 'REQ_STR', { required: true }), 'required string should throw');
  expect(String(err.message).indexOf('REQ_STR') >= 0, 'error should include key');
}

// String default and trim.
{
  props.store = { STR: '  hello  ' };
  const trimmed = sandbox.belle_cfg_getString_(props, 'STR', { trim: true });
  expect(trimmed === 'hello', 'trimmed string mismatch');
  const raw = sandbox.belle_cfg_getString_(props, 'STR', { trim: false });
  expect(raw === '  hello  ', 'raw string mismatch');
  const fallback = sandbox.belle_cfg_getString_(props, 'MISSING', { defaultValue: 'x' });
  expect(fallback === 'x', 'default string mismatch');
}

// Number parsing.
{
  props.store = { NUM: '42', BAD: 'abc' };
  const n = sandbox.belle_cfg_getNumber_(props, 'NUM', {});
  expect(n === 42, 'number parse mismatch');
  const err = expectThrows(() => sandbox.belle_cfg_getNumber_(props, 'BAD', { required: true }), 'invalid number should throw');
  expect(String(err.message).indexOf('BAD') >= 0, 'number error should include key');
  const fallback = sandbox.belle_cfg_getNumber_(props, 'MISSING', { defaultValue: 7 });
  expect(fallback === 7, 'number default mismatch');
}

// Bool parsing.
{
  props.store = { T: 'true', F: 'false', ONE: '1', ZERO: '0', BAD: 'maybe' };
  expect(sandbox.belle_cfg_getBool_(props, 'T', {}) === true, 'bool true mismatch');
  expect(sandbox.belle_cfg_getBool_(props, 'F', {}) === false, 'bool false mismatch');
  expect(sandbox.belle_cfg_getBool_(props, 'ONE', {}) === true, 'bool 1 mismatch');
  expect(sandbox.belle_cfg_getBool_(props, 'ZERO', {}) === false, 'bool 0 mismatch');
  const err = expectThrows(() => sandbox.belle_cfg_getBool_(props, 'BAD', { required: true }), 'invalid bool should throw');
  expect(String(err.message).indexOf('BAD') >= 0, 'bool error should include key');
  const fallback = sandbox.belle_cfg_getBool_(props, 'MISSING', { defaultValue: true });
  expect(fallback === true, 'bool default mismatch');
}

// JSON parsing.
{
  props.store = { JSON_OK: '{"a":1}', JSON_BAD: '{oops}' };
  const obj = sandbox.belle_cfg_getJson_(props, 'JSON_OK', {});
  expect(obj && obj.a === 1, 'json parse mismatch');
  const err = expectThrows(() => sandbox.belle_cfg_getJson_(props, 'JSON_BAD', { required: true }), 'invalid json should throw');
  expect(String(err.message).indexOf('JSON_BAD') >= 0, 'json error should include key');
  const fallback = sandbox.belle_cfg_getJson_(props, 'MISSING', { defaultValue: { ok: true } });
  expect(fallback && fallback.ok === true, 'json default mismatch');
}

console.log('OK: test_config_getters_parity');
