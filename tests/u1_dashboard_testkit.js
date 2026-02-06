const fs = require('fs');
const vm = require('vm');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  _sync() {
    this.element._className = Array.from(this.element._classSet).join(' ');
  }

  add() {
    for (let i = 0; i < arguments.length; i += 1) {
      const name = String(arguments[i] || '').trim();
      if (name) this.element._classSet.add(name);
    }
    this._sync();
  }

  remove() {
    for (let i = 0; i < arguments.length; i += 1) {
      const name = String(arguments[i] || '').trim();
      if (name) this.element._classSet.delete(name);
    }
    this._sync();
  }

  contains(name) {
    return this.element._classSet.has(String(name || ''));
  }
}

class FakeElement {
  constructor(tagName, id) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.id = id || '';
    this.attributes = {};
    this.disabled = false;
    this.textContent = '';
    this.childNodes = [];
    this.parentNode = null;
    this.listeners = {};
    this._classSet = new Set();
    this._className = '';
    this.classList = new FakeClassList(this);
  }

  get className() {
    return this._className;
  }

  set className(value) {
    const raw = String(value || '').trim();
    this._classSet = new Set(raw ? raw.split(/\s+/) : []);
    this._className = raw;
  }

  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  insertBefore(child, beforeNode) {
    const idx = this.childNodes.indexOf(beforeNode);
    if (idx < 0) return this.appendChild(child);
    child.parentNode = this;
    this.childNodes.splice(idx, 0, child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[String(name)] = String(value);
  }

  getAttribute(name) {
    const key = String(name);
    return Object.prototype.hasOwnProperty.call(this.attributes, key) ? this.attributes[key] : null;
  }

  addEventListener(type, handler) {
    const key = String(type);
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(handler);
  }

  dispatchEvent(event) {
    const evt = event || { type: '' };
    const key = String(evt.type || '');
    const list = this.listeners[key] || [];
    for (let i = 0; i < list.length; i += 1) {
      list[i].call(this, evt);
    }
  }

  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: 'click' });
  }

  get firstChild() {
    return this.childNodes.length > 0 ? this.childNodes[0] : null;
  }

  get lastChild() {
    return this.childNodes.length > 0 ? this.childNodes[this.childNodes.length - 1] : null;
  }

  set innerHTML(_value) {
    this.childNodes = [];
    this.textContent = '';
  }
}

class FakeDocument {
  constructor() {
    this.listeners = {};
    this.byId = {};
    this.selectorSingle = {};
    this.selectorList = {};
  }

  registerElement(element) {
    if (element.id) this.byId[element.id] = element;
    return element;
  }

  registerSelector(selector, element) {
    this.selectorSingle[String(selector)] = element;
  }

  registerSelectorList(selector, elements) {
    this.selectorList[String(selector)] = elements;
  }

  addEventListener(type, handler) {
    const key = String(type);
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(handler);
  }

  fire(type) {
    const key = String(type);
    const list = this.listeners[key] || [];
    for (let i = 0; i < list.length; i += 1) {
      list[i]({ type: key });
    }
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.byId[String(id)] || null;
  }

  querySelector(selector) {
    const key = String(selector);
    if (this.selectorSingle[key]) return this.selectorSingle[key];
    const m = key.match(/^#([A-Za-z0-9_-]+)\s+tbody$/);
    if (m) return this.selectorSingle['#' + m[1] + ' tbody'] || null;
    return null;
  }

  querySelectorAll(selector) {
    const list = this.selectorList[String(selector)];
    return list ? list.slice() : [];
  }
}

function extractDashboardScript() {
  const html = fs.readFileSync('gas/Dashboard.html', 'utf8');
  const match = html.match(/<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/);
  expect(match && match[0], 'Dashboard script block not found');
  const raw = match[0];
  return raw.replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');
}

function instrumentScript(script) {
  const anchor = 'document.addEventListener("DOMContentLoaded", boot);';
  const exportLine = [
    'window.__U1_TEST_HOOKS__ = {',
    '  u1_transport_callServer_: u1_transport_callServer_,',
    '  u1_state_projectMode_: u1_state_projectMode_,',
    '  u1_state_projectOverview_: u1_state_projectOverview_,',
    '  u1_render_modePanel_: u1_render_modePanel_,',
    '  u1_render_overviewTable_: u1_render_overviewTable_,',
    '  u1_action_wireDashboard_: u1_action_wireDashboard_,',
    '  applyHealthResult: applyHealthResult,',
    '  refreshMode: refreshMode,',
    '  runOp: runOp,',
    '  appState: appState',
    '};',
    anchor
  ].join('\n');
  expect(script.indexOf(anchor) >= 0, 'DOMContentLoaded anchor not found for instrumentation');
  return script.replace(anchor, exportLine);
}

function createGoogleMock(callLog, responseQueue) {
  const google = { script: {} };
  Object.defineProperty(google.script, 'run', {
    get() {
      let onSuccess = null;
      let onFailure = null;
      const runner = {
        withSuccessHandler(fn) {
          onSuccess = fn;
          return runner;
        },
        withFailureHandler(fn) {
          onFailure = fn;
          return new Proxy(
            {},
            {
              get(_target, prop) {
                return function () {
                  const args = Array.prototype.slice.call(arguments);
                  callLog.push({
                    fnName: String(prop),
                    argsLength: args.length,
                    payload: args.length > 0 ? args[0] : undefined
                  });
                  expect(responseQueue.length > 0, 'No mocked server response available for ' + String(prop));
                  const next = responseQueue.shift();
                  if (next.type === 'failure') {
                    expect(typeof onFailure === 'function', 'Failure handler missing for ' + String(prop));
                    onFailure(next.value);
                    return;
                  }
                  expect(typeof onSuccess === 'function', 'Success handler missing for ' + String(prop));
                  onSuccess(next.value);
                };
              }
            }
          );
        }
      };
      return runner;
    }
  });
  return google;
}

function createTableWithTbody(doc, id) {
  const table = doc.registerElement(new FakeElement('table', id));
  const tbody = new FakeElement('tbody');
  table.appendChild(tbody);
  doc.registerSelector('#' + id + ' tbody', tbody);
  return { table, tbody };
}

function createBaseDocument() {
  const doc = new FakeDocument();
  const elements = {};

  function add(tagName, id) {
    const el = doc.registerElement(new FakeElement(tagName, id));
    elements[id] = el;
    return el;
  }

  add('div', 'rx-current');
  add('div', 'rx-history');
  add('div', 'header-controls').classList.add('hidden');
  add('div', 'header-center').classList.add('hidden');
  add('span', 'mode-value');
  add('span', 'mode-expiry');
  add('span', 'ocr-run-badge');
  add('section', 'setup-view');
  add('section', 'dashboard-view').classList.add('hidden');
  add('div', 'setup-summary');

  add('button', 'btn-refresh-overview');
  add('button', 'btn-refresh-logs');
  add('button', 'btn-change-mode');
  add('button', 'btn-queue');
  add('button', 'btn-ocr-enable');
  add('button', 'btn-ocr-disable');
  add('button', 'btn-export-run');
  add('button', 'btn-archive-images');
  add('button', 'btn-archive-logs');
  add('button', 'btn-health-recheck');

  createTableWithTbody(doc, 'setup-table');
  createTableWithTbody(doc, 'overview-table');
  createTableWithTbody(doc, 'log-guard');
  createTableWithTbody(doc, 'log-export-skip');
  createTableWithTbody(doc, 'log-queue-skip');

  const tabBtnOverview = new FakeElement('button');
  tabBtnOverview.classList.add('tab-btn');
  tabBtnOverview.setAttribute('aria-controls', 'panel-overview');
  tabBtnOverview.setAttribute('aria-selected', 'true');

  const tabBtnLogs = new FakeElement('button');
  tabBtnLogs.classList.add('tab-btn');
  tabBtnLogs.setAttribute('aria-controls', 'panel-logs');
  tabBtnLogs.setAttribute('aria-selected', 'false');

  const panelOverview = doc.registerElement(new FakeElement('section', 'panel-overview'));
  panelOverview.classList.add('tab-panel', 'active');
  const panelLogs = doc.registerElement(new FakeElement('section', 'panel-logs'));
  panelLogs.classList.add('tab-panel');

  doc.registerSelectorList('.tab-btn', [tabBtnOverview, tabBtnLogs]);
  doc.registerSelectorList('.tab-panel', [panelOverview, panelLogs]);

  return { document: doc, elements };
}

function getReactionEntryInfo(entry) {
  const labelNode = entry.childNodes.find((n) => n.classList && n.classList.contains('rx-label'));
  const textNode = entry.childNodes.find((n) => n.classList && n.classList.contains('rx-text'));
  return {
    level: labelNode ? String(labelNode.textContent || '') : '',
    text: textNode ? String(textNode.textContent || '') : ''
  };
}

function getCurrentReaction(document) {
  const current = document.getElementById('rx-current');
  if (!current) return { level: '', text: '' };
  return getReactionEntryInfo(current);
}

function getHistoryReactions(document) {
  const history = document.getElementById('rx-history');
  if (!history) return [];
  return history.childNodes.map(getReactionEntryInfo);
}

function createHarness(options) {
  const opts = options || {};
  const queue = [];
  const callLog = [];
  const confirmQueue = [];
  const confirmLog = [];
  const base = createBaseDocument();
  const document = base.document;
  const elements = base.elements;
  const google = createGoogleMock(callLog, queue);

  const windowObj = {
    __BOOT_HEALTH__: Object.prototype.hasOwnProperty.call(opts, 'bootHealth') ? opts.bootHealth : null
  };
  windowObj.confirm = function (message) {
    confirmLog.push(String(message || ''));
    if (confirmQueue.length === 0) return true;
    return !!confirmQueue.shift();
  };
  windowObj.window = windowObj;
  windowObj.document = document;

  const sandbox = {
    console,
    window: windowObj,
    document,
    google,
    Date
  };
  vm.createContext(sandbox);
  const script = instrumentScript(extractDashboardScript());
  vm.runInContext(script, sandbox, { filename: 'Dashboard.inline.js' });

  return {
    window: windowObj,
    document,
    elements,
    calls: callLog,
    confirms: confirmLog,
    enqueueSuccess(value) {
      queue.push({ type: 'success', value });
    },
    enqueueFailure(value) {
      queue.push({ type: 'failure', value });
    },
    enqueueConfirm(value) {
      confirmQueue.push(!!value);
    },
    fireDOMContentLoaded() {
      document.fire('DOMContentLoaded');
    },
    hooks() {
      return windowObj.__U1_TEST_HOOKS__;
    },
    currentReaction() {
      return getCurrentReaction(document);
    },
    historyReactions() {
      return getHistoryReactions(document);
    }
  };
}

module.exports = {
  expect,
  extractDashboardScript,
  createHarness
};
