function expectTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected=${expected} actual=${actual}`);
  }
}

function expectArrayEqual(actual, expected, message) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error(`${message}: both values must be arrays`);
  }
  if (actual.length !== expected.length) {
    throw new Error(`${message}: array length mismatch`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(`${message}: mismatch at index ${i}`);
    }
  }
}

module.exports = {
  expectTrue,
  expectEqual,
  expectArrayEqual
};
