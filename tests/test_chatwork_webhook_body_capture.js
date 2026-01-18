const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const code = fs.readFileSync('gas/ChatworkWebhook_v0.js', 'utf8');
const sandbox = {
  console,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF-8' },
    computeDigest: (algo, text) => {
      const hash = crypto.createHash('sha256').update(text, 'utf8').digest();
      return Array.from(hash);
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const p1 = {
  webhook_event: {
    body: 'hello'
  }
};
const r1 = sandbox.belle_chatwork_webhook_extractBody_(p1);
expect(r1.rawBody === 'hello', 'p1 rawBody');
expect(r1.bodySource === 'webhook_event.body', 'p1 source');
const h1 = sandbox.belle_chatwork_webhook_hashSha256Hex_(r1.rawBody);
expect(h1 && h1.length === 64, 'p1 hash length');

const p2 = {
  webhook_event: {
    message: { body: 'hello2' }
  }
};
const r2 = sandbox.belle_chatwork_webhook_extractBody_(p2);
expect(r2.rawBody === 'hello2', 'p2 rawBody');
expect(r2.bodySource === 'webhook_event.message.body', 'p2 source');
const h2 = sandbox.belle_chatwork_webhook_hashSha256Hex_(r2.rawBody);
expect(h2 && h2.length === 64, 'p2 hash length');

console.log('OK: test_chatwork_webhook_body_capture');
