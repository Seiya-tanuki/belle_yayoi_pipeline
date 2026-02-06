const { expectTrue, expectEqual, expectArrayEqual } = require('./helpers/assertions');

expectTrue(true, 'expectTrue should pass');
expectEqual('x', 'x', 'expectEqual should pass');
expectArrayEqual([1, 2], [1, 2], 'expectArrayEqual should pass');

let threw = false;
try {
  expectTrue(false, 'expected failure');
} catch (error) {
  threw = error.message.indexOf('expected failure') >= 0;
}

expectTrue(threw, 'assertion helper should throw with message');

console.log('OK: t1_helper_assertions_smoke');
