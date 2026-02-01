const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const code = fs.readFileSync('gas/Config.js', 'utf8')
  + '\n' + fs.readFileSync('gas/ChatworkWebhook.js', 'utf8');
const logs = [];

const sandbox = {
  __props: {},
  console: {
    log: (msg) => logs.push(String(msg))
  },
  Logger: {
    log: (msg) => logs.push(String(msg))
  },
  ContentService: {
    createTextOutput: (text) => ({ text })
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => sandbox.__props[key] || ''
    })
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF-8' },
    computeDigest: () => new Array(32).fill(0),
    base64Decode: (text) => Array.from(Buffer.from(String(text || ''), 'base64')),
    base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
    newBlob: (text) => ({
      getBytes: () => Array.from(Buffer.from(String(text || ''), 'utf8'))
    }),
    computeHmacSha256Signature: (bytes, secretBytes) => {
      const hmac = crypto.createHmac('sha256', Buffer.from(secretBytes));
      hmac.update(Buffer.from(bytes));
      return Array.from(hmac.digest());
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

function findPhase(phase) {
  for (let i = 0; i < logs.length; i++) {
    try {
      const obj = JSON.parse(logs[i]);
      if (obj && obj.phase === phase) return obj;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

function runWith(props, e) {
  sandbox.__props = props || {};
  logs.length = 0;
  sandbox.belle_chatwork_webhook_handle_(e);
}

runWith({ BELLE_CHATWORK_WEBHOOK_ENABLED: 'false' }, {});
const a = findPhase('CHATWORK_WEBHOOK_GUARD');
expect(a && a.reason === 'WEBHOOK_DISABLED', 'A: WEBHOOK_DISABLED');

runWith(
  { BELLE_CHATWORK_WEBHOOK_ENABLED: 'true', BELLE_CHATWORK_WEBHOOK_ROUTE: 'chatwork' },
  { parameter: { route: 'x' } }
);
const b = findPhase('CHATWORK_WEBHOOK_GUARD');
expect(b && b.reason === 'ROUTE_MISMATCH', 'B: ROUTE_MISMATCH');

runWith(
  {
    BELLE_CHATWORK_WEBHOOK_ENABLED: 'true',
    BELLE_CHATWORK_WEBHOOK_ROUTE: 'chatwork',
    BELLE_CHATWORK_WEBHOOK_TOKEN: 'secret'
  },
  {
    parameter: { route: 'chatwork', token: 'bad' },
    postData: { contents: '{"webhook_event_type":"message_created"}' }
  }
);
const c = findPhase('CHATWORK_WEBHOOK_GUARD');
expect(c && c.reason === 'TOKEN_MISMATCH', 'C: TOKEN_MISMATCH');

runWith(
  {
    BELLE_CHATWORK_WEBHOOK_ENABLED: 'true',
    BELLE_CHATWORK_WEBHOOK_ROUTE: 'chatwork',
    BELLE_CHATWORK_WEBHOOK_TOKEN: 'secret'
  },
  {
    parameter: { route: 'chatwork', token: 'secret' },
    postData: {
      contents: JSON.stringify({
        webhook_event_type: 'message_created',
        webhook_setting_id: 'w1',
        webhook_event_time: 1700000000,
        room_id: 123,
        account_id: 456,
        message_id: 789,
        webhook_event: { body: 'hello' }
      })
    }
  }
);
const d = findPhase('CHATWORK_WEBHOOK_EVENT');
expect(d && d.webhook_event_type === 'message_created', 'D: EVENT_LOG');
expect(d && d.body_preview === 'hello', 'D: EVENT_BODY_PREVIEW');

const signatureBody = JSON.stringify({
  webhook_event_type: 'message_created',
  webhook_setting_id: 'w2',
  webhook_event_time: 1700000001,
  room_id: 222,
  account_id: 333,
  message_id: 444,
  webhook_event: { body: 'signed' }
});
const signatureSecret = Buffer.from('sig-secret', 'utf8').toString('base64');
const signature = sandbox.belle_chatwork_webhook_computeSignature_(signatureBody, signatureSecret);

runWith(
  {
    BELLE_CHATWORK_WEBHOOK_ENABLED: 'true',
    BELLE_CHATWORK_WEBHOOK_ROUTE: 'chatwork',
    BELLE_CHATWORK_WEBHOOK_TOKEN: 'secret',
    BELLE_CHATWORK_WEBHOOK_SIGNATURE_SECRET_B64: signatureSecret
  },
  {
    parameter: {
      route: 'chatwork',
      token: 'secret',
      chatwork_webhook_signature: signature
    },
    postData: { contents: signatureBody }
  }
);
const e = findPhase('CHATWORK_WEBHOOK_EVENT');
expect(e && e.webhook_event_type === 'message_created', 'E: SIGNATURE_OK');

runWith(
  {
    BELLE_CHATWORK_WEBHOOK_ENABLED: 'true',
    BELLE_CHATWORK_WEBHOOK_ROUTE: 'chatwork',
    BELLE_CHATWORK_WEBHOOK_TOKEN: 'secret',
    BELLE_CHATWORK_WEBHOOK_SIGNATURE_SECRET_B64: signatureSecret
  },
  {
    parameter: { route: 'chatwork', token: 'secret' },
    postData: { contents: signatureBody }
  }
);
const f = findPhase('CHATWORK_WEBHOOK_GUARD');
expect(f && f.reason === 'SIGNATURE_MISSING', 'F: SIGNATURE_MISSING');

runWith(
  {
    BELLE_CHATWORK_WEBHOOK_ENABLED: 'true',
    BELLE_CHATWORK_WEBHOOK_ROUTE: 'chatwork',
    BELLE_CHATWORK_WEBHOOK_TOKEN: 'secret',
    BELLE_CHATWORK_WEBHOOK_SIGNATURE_SECRET_B64: signatureSecret
  },
  {
    parameter: {
      route: 'chatwork',
      token: 'secret',
      chatwork_webhook_signature: 'bad'
    },
    postData: { contents: signatureBody }
  }
);
const g = findPhase('CHATWORK_WEBHOOK_GUARD');
expect(g && g.reason === 'SIGNATURE_MISMATCH', 'G: SIGNATURE_MISMATCH');

console.log('OK: test_chatwork_webhook');
