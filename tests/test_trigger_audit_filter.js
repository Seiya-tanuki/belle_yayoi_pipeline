const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('gas/OcrParallelTrigger.js', 'utf8');
const deleted = [];

const triggers = [
  {
    id: 't1',
    handler: 'belle_queueFolderFilesToSheet_test',
    eventType: 'TIME',
    getHandlerFunction() { return this.handler; },
    getEventType() { return this.eventType; },
    getUniqueId() { return this.id; }
  },
  {
    id: 't2',
    handler: 'some_custom_test',
    eventType: 'TIME',
    getHandlerFunction() { return this.handler; },
    getEventType() { return this.eventType; },
    getUniqueId() { return this.id; }
  },
  {
    id: 't3',
    handler: 'belle_ocr_workerTick',
    eventType: 'TIME',
    getHandlerFunction() { return this.handler; },
    getEventType() { return this.eventType; },
    getUniqueId() { return this.id; }
  },
  {
    id: 't4',
    handler: 'belle_exportYayoiCsv',
    eventType: 'MANUAL',
    getHandlerFunction() { return this.handler; },
    getEventType() { return this.eventType; },
    getUniqueId() { return this.id; }
  }
];

const sandbox = {
  console,
  Logger: { log: () => {} },
  ScriptApp: {
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger: (t) => deleted.push(t.getUniqueId())
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const res = sandbox.belle_triggerAuditOnly();
expect(res && res.removedCount === 2, 'removedCount should be 2');
deleted.sort();
expect(deleted.join(',') === 't1,t2', 'deleted triggers mismatch');

console.log('OK: test_trigger_audit_filter');
