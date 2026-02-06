class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowIdx = this.row - 1 + r;
      const row = this.sheet.data[rowIdx] || [];
      const vals = [];
      for (let c = 0; c < this.numCols; c++) {
        const colIdx = this.col - 1 + c;
        vals.push(row[colIdx] !== undefined ? row[colIdx] : '');
      }
      out.push(vals);
    }
    return out;
  }

  setValue(value) {
    if (!this.sheet.data[this.row - 1]) {
      this.sheet.data[this.row - 1] = [];
    }
    this.sheet.data[this.row - 1][this.col - 1] = value;
    return this;
  }

  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIdx = this.row - 1 + r;
      if (!this.sheet.data[rowIdx]) {
        this.sheet.data[rowIdx] = [];
      }
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = this.col - 1 + c;
        this.sheet.data[rowIdx][colIdx] = values[r][c];
      }
    }
    return this;
  }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
  }

  getLastRow() {
    return this.data.length;
  }

  getRange(row, col, numRows, numCols) {
    return new MockRange(this, row, col, numRows, numCols);
  }

  appendRow(row) {
    this.data.push(row.slice());
    return this;
  }

  clear() {
    this.data = [];
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {};
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets[name] = sheet;
    return sheet;
  }
}

function bytesFromString(value) {
  const bytes = [];
  for (let i = 0; i < value.length; i++) {
    bytes.push(value.charCodeAt(i));
  }
  return bytes;
}

module.exports = {
  MockRange,
  MockSheet,
  MockSpreadsheet,
  bytesFromString
};
