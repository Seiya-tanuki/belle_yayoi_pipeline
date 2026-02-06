const fs = require('fs');
const vm = require('vm');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ' (actual=' + String(actual) + ', expected=' + String(expected) + ')');
  }
}

function makeIterator(items) {
  let index = 0;
  return {
    hasNext: () => index < items.length,
    next: () => {
      if (index >= items.length) throw new Error('iterator exhausted');
      return items[index++];
    }
  };
}

class MockFolder {
  constructor(name) {
    this.name = name;
    this.subfolders = {};
    this.files = [];
    this.failCreateFor = null;
  }

  addSubfolder(name, folder) {
    this.subfolders[name] = folder;
  }

  addFile(file) {
    this.files.push(file);
  }

  getFoldersByName(name) {
    const hit = this.subfolders[name] || null;
    return makeIterator(hit ? [hit] : []);
  }

  createFolder(name) {
    if (this.failCreateFor && this.failCreateFor === name) {
      throw new Error('create folder failed: ' + name);
    }
    const created = new MockFolder(name);
    this.subfolders[name] = created;
    return created;
  }

  getFiles() {
    return makeIterator(this.files.slice());
  }
}

function createPropsStore(initial) {
  const store = Object.assign({}, initial || {});
  return {
    getProperty: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? String(store[key]) : '')
  };
}

function createMockFile(id, name, options) {
  const opts = options || {};
  return {
    getId: () => String(id),
    getName: () => String(name),
    moveTo: (_folder) => {
      if (opts.failMove) throw new Error('move failed');
    }
  };
}

function buildSandbox(options) {
  const opts = options || {};
  const driveRootId = String(opts.driveRootId || 'drive-root');
  const archiveRootId = String(opts.archiveRootId || 'archive-root');
  const props = createPropsStore({
    BELLE_DRIVE_FOLDER_ID: driveRootId,
    BELLE_IMAGES_ARCHIVE_FOLDER_ID: archiveRootId
  });

  const sourceRoot = opts.sourceRoot || new MockFolder('drive-root');
  const archiveRoot = opts.archiveRoot || new MockFolder('archive-root');
  const activeDocTypes = Array.isArray(opts.activeDocTypes) ? opts.activeDocTypes.slice() : [];
  const docSpecs = Object.assign({}, opts.docSpecs || {});

  const nowValues = Array.isArray(opts.nowValues) && opts.nowValues.length > 0 ? opts.nowValues.slice() : [1000];
  let nowIndex = 0;

  const sandbox = {
    console,
    Date: {
      now: () => {
        const value = nowValues[Math.min(nowIndex, nowValues.length - 1)];
        nowIndex += 1;
        return value;
      }
    },
    belle_cfg_getProps_: () => props,
    belle_cfg_getString_: (inProps, key, cfg) => {
      const value = String(inProps.getProperty(key) || '').trim();
      if (value) return value;
      if (cfg && Object.prototype.hasOwnProperty.call(cfg, 'defaultValue')) return String(cfg.defaultValue);
      return '';
    },
    DriveApp: {
      getFolderById: (id) => {
        const key = String(id);
        if (key === driveRootId) return sourceRoot;
        if (key === archiveRootId) return archiveRoot;
        throw new Error('unknown folder id: ' + key);
      }
    },
    belle_ocr_getActiveDocTypes_: () => activeDocTypes.slice(),
    belle_docType_getSpec_: (docType) => (Object.prototype.hasOwnProperty.call(docSpecs, docType) ? docSpecs[docType] : null)
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('gas/ImageArchiveBatchService.js', 'utf8'), sandbox);

  return {
    sandbox
  };
}

function testSuccessContract() {
  const sourceRoot = new MockFolder('drive-root');
  const archiveRoot = new MockFolder('archive-root');

  const receiptSource = new MockFolder('receipt_inbox');
  receiptSource.addFile(createMockFile('f-1', 'first.png'));
  receiptSource.addFile(createMockFile('f-2', 'second.png'));
  sourceRoot.addSubfolder('receipt_inbox', receiptSource);

  const ctx = buildSandbox({
    sourceRoot,
    archiveRoot,
    activeDocTypes: ['receipt', 'cc_statement'],
    docSpecs: {
      receipt: { source_subfolder_name: 'receipt_inbox' },
      cc_statement: { source_subfolder_name: 'cc_inbox' }
    },
    nowValues: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]
  });

  const res = ctx.sandbox.belle_image_archive_batch_run_();
  expectEqual(res.ok, true, 'success should be ok');
  expectEqual(res.reason, 'OK', 'success reason mismatch');
  expectEqual(res.message, 'Image archive completed.', 'success message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'success should include data');
  expectEqual(res.data.moved_total, 2, 'success moved_total mismatch');
  expectEqual(res.data.moved_by_doc_type.receipt, 2, 'success moved_by_doc_type mismatch');
  expectEqual(res.data.remaining, false, 'success remaining mismatch');
  expectEqual(res.data.limit_hit, false, 'success limit_hit mismatch');
  expectEqual(res.data.time_hit, false, 'success time_hit mismatch');
  expect(Array.isArray(res.data.missing_sources), 'success missing_sources should be array');
  expectEqual(res.data.missing_sources.length, 1, 'success missing_sources length mismatch');
  expectEqual(res.data.missing_sources[0], 'cc_inbox', 'success missing source mismatch');
  expectEqual(res.data.elapsed_ms, 0, 'success elapsed_ms should be deterministic');
}

function testMoveFailureStructuredData() {
  const sourceRoot = new MockFolder('drive-root');
  const archiveRoot = new MockFolder('archive-root');

  const receiptSource = new MockFolder('receipt_inbox');
  receiptSource.addFile(createMockFile('f-err', 'broken.png', { failMove: true }));
  sourceRoot.addSubfolder('receipt_inbox', receiptSource);

  const ctx = buildSandbox({
    sourceRoot,
    archiveRoot,
    activeDocTypes: ['receipt'],
    docSpecs: {
      receipt: { source_subfolder_name: 'receipt_inbox' }
    },
    nowValues: [1000, 1000, 1000, 1000]
  });

  const res = ctx.sandbox.belle_image_archive_batch_run_();
  expectEqual(res.ok, false, 'move failure should fail');
  expectEqual(res.reason, 'MOVE_FAILED', 'move failure reason mismatch');
  expectEqual(res.message, 'Failed to move image.', 'move failure message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'move failure should include data');
  expectEqual(res.data.doc_type, 'receipt', 'move failure doc_type mismatch');
  expectEqual(res.data.file_id, 'f-err', 'move failure file_id mismatch');
  expectEqual(res.data.name, 'broken.png', 'move failure name mismatch');
}

function testSubfolderCreateFailureStructuredData() {
  const sourceRoot = new MockFolder('drive-root');
  const archiveRoot = new MockFolder('archive-root');

  const receiptSource = new MockFolder('receipt_inbox');
  sourceRoot.addSubfolder('receipt_inbox', receiptSource);
  archiveRoot.failCreateFor = 'receipt_inbox';

  const ctx = buildSandbox({
    sourceRoot,
    archiveRoot,
    activeDocTypes: ['receipt'],
    docSpecs: {
      receipt: { source_subfolder_name: 'receipt_inbox' }
    },
    nowValues: [1000, 1000, 1000, 1000]
  });

  const res = ctx.sandbox.belle_image_archive_batch_run_();
  expectEqual(res.ok, false, 'subfolder create failure should fail');
  expectEqual(res.reason, 'ARCHIVE_SUBFOLDER_CREATE_FAILED', 'subfolder create failure reason mismatch');
  expectEqual(res.message, 'Archive subfolder create failed.', 'subfolder create failure message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'subfolder create failure should include data');
  expectEqual(res.data.subfolder, 'receipt_inbox', 'subfolder create failure data mismatch');
}

testSuccessContract();
testMoveFailureStructuredData();
testSubfolderCreateFailureStructuredData();

console.log('OK: test_image_archive_batch_service');
