const fs = require('fs');
const vm = require('vm');

function createSandbox(extraGlobals) {
  const sandbox = Object.assign({ console }, extraGlobals || {});
  vm.createContext(sandbox);
  return sandbox;
}

function runSourcesInOrder(sources, sandbox) {
  if (!Array.isArray(sources)) {
    throw new Error('sources must be an array');
  }
  const target = sandbox || createSandbox();
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source || typeof source.code !== 'string') {
      throw new Error(`invalid source at index ${i}`);
    }
    const filename = source.filename || `inline_source_${i + 1}.js`;
    vm.runInContext(source.code, target, { filename });
  }
  return target;
}

function loadFilesInOrder(filePaths, extraGlobals) {
  if (!Array.isArray(filePaths)) {
    throw new Error('filePaths must be an array');
  }
  const sources = filePaths.map((filePath) => ({
    filename: filePath,
    code: fs.readFileSync(filePath, 'utf8')
  }));
  return runSourcesInOrder(sources, createSandbox(extraGlobals));
}

module.exports = {
  createSandbox,
  runSourcesInOrder,
  loadFilesInOrder
};
