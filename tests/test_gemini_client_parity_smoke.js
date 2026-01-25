const fs = require('fs');
const vm = require('vm');

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

const code = fs.readFileSync('gas/Config_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Gemini_v0.js', 'utf8')
  + '\n' + fs.readFileSync('gas/Code.js', 'utf8');

const captured = { url: '', options: null };
const sandbox = {
  console,
  Utilities: {
    base64Encode: () => 'BASE64'
  },
  UrlFetchApp: {
    fetch: (url, options) => {
      captured.url = url;
      captured.options = options;
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }]
        })
      };
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

sandbox.belle_cfg_getProps_ = () => ({
  getProperty: (key) => {
    if (key === 'BELLE_GEMINI_API_KEY') return 'KEY';
    if (key === 'BELLE_GEMINI_MODEL') return 'model-x';
    if (key === 'BELLE_GEMINI_SLEEP_MS') return '500';
    if (key === 'BELLE_MAX_ITEMS_PER_RUN') return '1';
    return '';
  }
});

const blob = {
  getContentType: () => 'image/png',
  getBytes: () => [1, 2, 3]
};

const result = sandbox.belle_callGeminiOcr(blob, {
  promptText: 'PROMPT',
  temperature: 0.7,
  responseMimeType: 'application/json',
  responseJsonSchema: { type: 'object' },
  generationConfig: { maxOutputTokens: 5 }
});

expect(result === '{"ok":true}', 'should return JSON string');
expect(captured.url.indexOf('generativelanguage.googleapis.com') >= 0, 'should call Gemini host');
expect(captured.url.indexOf('model-x') >= 0, 'should include model in URL');
expect(captured.url.indexOf('key=KEY') >= 0, 'should include api key in URL');

const payload = JSON.parse(captured.options.payload);
expect(payload.contents[0].parts[0].text === 'PROMPT', 'should include prompt text');
expect(payload.contents[0].parts[1].inline_data.mime_type === 'image/png', 'should include mime type');
expect(payload.contents[0].parts[1].inline_data.data === 'BASE64', 'should include base64');
expect(payload.generationConfig.temperature === 0.7, 'should set temperature');
expect(payload.generationConfig.maxOutputTokens === 5, 'should include generationConfig overrides');
expect(payload.generationConfig.responseMimeType === 'application/json', 'should include responseMimeType');
expect(payload.generationConfig.responseJsonSchema.type === 'object', 'should include responseJsonSchema');

console.log('OK: test_gemini_client_parity_smoke');
