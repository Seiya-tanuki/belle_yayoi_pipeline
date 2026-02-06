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
  }

  getFoldersByName(name) {
    const hit = this.subfolders[name] || null;
    return makeIterator(hit ? [hit] : []);
  }

  createFolder(name) {
    const created = new MockFolder(name);
    this.subfolders[name] = created;
    return created;
  }
}

class MockArchiveSpreadsheet {
  constructor(id) {
    this.id = id;
    this.sheets = [{ name: 'Sheet1' }];
    this.createdName = '';
  }

  getId() {
    return this.id;
  }

  getSheetByName(name) {
    for (let i = 0; i < this.sheets.length; i++) {
      if (this.sheets[i].name === name) return this.sheets[i];
    }
    return null;
  }

  getSheets() {
    return this.sheets.slice();
  }

  deleteSheet(sheet) {
    this.sheets = this.sheets.filter((item) => item !== sheet);
  }

  __addCopiedSheet(initialName) {
    const copied = {
      name: initialName,
      setName(newName) {
        this.name = newName;
        return this;
      }
    };
    this.sheets.push(copied);
    return copied;
  }
}

class MockSourceSheet {
  constructor(name, lastRow) {
    this.name = name;
    this.lastRow = Number(lastRow || 1);
    this.copyShouldThrow = false;
    this.deleteCalls = [];
  }

  setCopyFailure(enabled) {
    this.copyShouldThrow = Boolean(enabled);
  }

  copyTo(destSpreadsheet) {
    if (this.copyShouldThrow) throw new Error('copy failed: ' + this.name);
    return destSpreadsheet.__addCopiedSheet(this.name);
  }

  getLastRow() {
    return this.lastRow;
  }

  deleteRows(startRow, count) {
    this.deleteCalls.push({ startRow, count });
    this.lastRow = Math.max(1, this.lastRow - count);
  }
}

function createPropsStore(initial) {
  const store = Object.assign({}, initial || {});
  return {
    getProperty: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? String(store[key]) : '')
  };
}

function buildSandbox(options) {
  const opts = options || {};
  const archiveRootId = String(opts.archiveRootId || 'archive-root');
  const integrationsId = String(opts.integrationsId || 'integrations-1');
  const archiveName = String(opts.archiveName || 'belle_yayoi_logs_archive_20260206_010203');
  const archiveSpreadsheetId = String(opts.archiveSpreadsheetId || 'ARCHIVE_SS_1');
  const rootFolder = new MockFolder('archive-root');
  const archiveFileMoves = [];

  const sourceSheets = {};
  const sheetRows = opts.sheetRows || {};
  Object.keys(sheetRows).forEach((name) => {
    sourceSheets[name] = new MockSourceSheet(name, sheetRows[name]);
  });
  if (opts.copyFailsFor && sourceSheets[opts.copyFailsFor]) {
    sourceSheets[opts.copyFailsFor].setCopyFailure(true);
  }

  const integrationsSpreadsheet = {
    getSheetByName: (name) => (Object.prototype.hasOwnProperty.call(sourceSheets, name) ? sourceSheets[name] : null)
  };

  let createdArchiveSpreadsheet = null;

  const props = createPropsStore({
    BELLE_INTEGRATIONS_SHEET_ID: integrationsId,
    BELLE_LOG_ARCHIVE_FOLDER_ID: archiveRootId
  });

  const sandbox = {
    console,
    Session: {
      getScriptTimeZone: () => 'Asia/Tokyo'
    },
    Utilities: {
      formatDate: (_date, _tz, pattern) => {
        if (pattern === 'yyyy') return '2026';
        if (pattern === 'MM') return '02';
        return '';
      }
    },
    belle_cfg_getProps_: () => props,
    belle_archive_buildName_: () => archiveName,
    SpreadsheetApp: {
      openById: (id) => {
        if (String(id) !== integrationsId) throw new Error('unexpected sheet id: ' + String(id));
        return integrationsSpreadsheet;
      },
      create: (name) => {
        createdArchiveSpreadsheet = new MockArchiveSpreadsheet(archiveSpreadsheetId);
        createdArchiveSpreadsheet.createdName = String(name);
        return createdArchiveSpreadsheet;
      }
    },
    DriveApp: {
      getFolderById: (id) => {
        if (String(id) !== archiveRootId) throw new Error('folder open failed');
        return rootFolder;
      },
      getFileById: (id) => ({
        moveTo: (folder) => {
          archiveFileMoves.push({ fileId: String(id), folderName: folder && folder.name ? folder.name : '' });
        }
      })
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('gas/LogArchiveService.js', 'utf8'), sandbox);

  return {
    sandbox,
    sourceSheets,
    archiveFileMoves,
    getCreatedArchiveSpreadsheet: () => createdArchiveSpreadsheet
  };
}

function testSuccessContract() {
  const ctx = buildSandbox({
    sheetRows: {
      PERF_LOG: 4,
      DASHBOARD_AUDIT_LOG: 2
    }
  });

  const res = ctx.sandbox.belle_logArchive_archiveLogs_();
  expectEqual(res.ok, true, 'success should be ok');
  expectEqual(res.reason, 'OK', 'success reason mismatch');
  expectEqual(res.message, 'Logs archived and cleared.', 'success message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'success should include data');
  expectEqual(res.data.archive_id, 'ARCHIVE_SS_1', 'success archive id mismatch');
  expectEqual(res.data.archive_name, 'belle_yayoi_logs_archive_20260206_010203', 'success archive name mismatch');
  expectEqual(res.data.folder_path, 'export_run_reports/2026/02', 'success folder path mismatch');
  expectEqual(res.data.cleared.PERF_LOG, 3, 'PERF_LOG cleared count mismatch');
  expectEqual(res.data.cleared.DASHBOARD_AUDIT_LOG, 1, 'DASHBOARD_AUDIT_LOG cleared count mismatch');

  const created = ctx.getCreatedArchiveSpreadsheet();
  expect(created, 'archive spreadsheet should be created');
  expectEqual(created.createdName, 'belle_yayoi_logs_archive_20260206_010203', 'create() should receive deterministic archive name');
  expectEqual(ctx.archiveFileMoves.length, 1, 'archive file should be moved once');
  expectEqual(ctx.archiveFileMoves[0].folderName, '02', 'archive file move target should be month folder');
}

function testMissingSheetFailure() {
  const ctx = buildSandbox({
    sheetRows: {
      PERF_LOG: 3
    }
  });

  const res = ctx.sandbox.belle_logArchive_archiveLogs_();
  expectEqual(res.ok, false, 'missing sheet should fail');
  expectEqual(res.reason, 'LOG_SHEET_MISSING', 'missing sheet reason mismatch');
  expectEqual(res.message, 'Missing log sheets.', 'missing sheet message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'missing sheet should include data object');
  expect(Array.isArray(res.data.missing), 'missing sheet data should include missing array');
  expectEqual(res.data.missing.length, 1, 'missing array length mismatch');
  expectEqual(res.data.missing[0], 'DASHBOARD_AUDIT_LOG', 'missing sheet name mismatch');
}

function testCopyFailureStructuredData() {
  const ctx = buildSandbox({
    sheetRows: {
      PERF_LOG: 5,
      DASHBOARD_AUDIT_LOG: 6
    },
    copyFailsFor: 'DASHBOARD_AUDIT_LOG'
  });

  const res = ctx.sandbox.belle_logArchive_archiveLogs_();
  expectEqual(res.ok, false, 'copy failure should fail');
  expectEqual(res.reason, 'ARCHIVE_COPY_FAILED', 'copy failure reason mismatch');
  expectEqual(res.message, 'Failed to copy log sheets.', 'copy failure message mismatch');
  expect(typeof res.data === 'object' && res.data !== null, 'copy failure should include data');
  expectEqual(res.data.archive_id, 'ARCHIVE_SS_1', 'copy failure archive id mismatch');
  expectEqual(res.data.archive_name, 'belle_yayoi_logs_archive_20260206_010203', 'copy failure archive name mismatch');
  expectEqual(ctx.sourceSheets.PERF_LOG.deleteCalls.length, 0, 'rows should not be cleared on copy failure');
  expectEqual(ctx.sourceSheets.DASHBOARD_AUDIT_LOG.deleteCalls.length, 0, 'rows should not be cleared on copy failure');
}

testSuccessContract();
testMissingSheetFailure();
testCopyFailureStructuredData();

console.log('OK: test_log_archive_service');
