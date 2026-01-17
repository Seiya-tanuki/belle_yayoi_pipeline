// @ts-check

// NOTE: Keep comments ASCII only.

function belle_chatwork_webhook_parseBool_(value, defaultValue) {
  if (value === true || value === false) return value;
  const s = String(value || "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultValue;
}

function belle_chatwork_webhook_getExpectedRoute_(props) {
  return props.getProperty("BELLE_CHATWORK_WEBHOOK_ROUTE") || "chatwork";
}

function belle_chatwork_webhook_computeSignature_(bodyString, tokenBase64) {
  if (!tokenBase64) return "";
  const secretBytes = Utilities.base64Decode(String(tokenBase64));
  const bodyBytes = Utilities.newBlob(String(bodyString || ""), "text/plain").getBytes();
  const digest = Utilities.computeHmacSha256Signature(bodyBytes, secretBytes);
  return Utilities.base64Encode(digest);
}

function belle_chatwork_webhook_truncate_(text, maxLen) {
  const s = String(text || "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...(truncated)";
}

function belle_chatwork_webhook_ensureLogSheet_(ss) {
  const name = "WEBHOOK_LOG";
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const header = ["received_at_iso", "phase", "detail"];
  const current = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  const mismatch = header.some(function (h, i) {
    return String(current[i] || "") !== h;
  });
  if (mismatch) {
    sheet.clear();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sheet;
}

function belle_chatwork_webhook_appendLogRow_(phase, detailObjOrString) {
  const props = PropertiesService.getScriptProperties();
  const integrationsSheetId = props.getProperty("BELLE_INTEGRATIONS_SHEET_ID");
  if (!integrationsSheetId) return false;

  let detail = "";
  try {
    detail = JSON.stringify(detailObjOrString);
  } catch (e) {
    detail = String(detailObjOrString);
  }
  detail = belle_chatwork_webhook_truncate_(detail, 2000);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.openById(integrationsSheetId);
    const sheet = belle_chatwork_webhook_ensureLogSheet_(ss);
    sheet.appendRow([new Date().toISOString(), String(phase || ""), detail]);
  } finally {
    lock.releaseLock();
  }
  return true;
}

function belle_chatwork_webhook_log_(obj) {
  const msg = JSON.stringify(obj);
  console.log(msg);
  Logger.log(msg);
  try {
    belle_chatwork_webhook_appendLogRow_(obj && obj.phase ? obj.phase : "CHATWORK_WEBHOOK_LOG", obj);
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    console.log("CHATWORK_WEBHOOK_LOG_APPEND_ERROR:" + message);
    Logger.log("CHATWORK_WEBHOOK_LOG_APPEND_ERROR:" + message);
  }
}

function belle_chatwork_webhook_logEvent_(payload) {
  const eventType = payload && payload.webhook_event_type ? String(payload.webhook_event_type) : "";
  const body = payload && payload.body ? String(payload.body) : "";
  belle_chatwork_webhook_log_({
    phase: "CHATWORK_WEBHOOK_EVENT",
    webhook_setting_id: payload && payload.webhook_setting_id,
    webhook_event_type: eventType,
    webhook_event_time: payload && payload.webhook_event_time,
    room_id: payload && payload.room_id,
    account_id: payload && payload.account_id,
    message_id: payload && payload.message_id,
    body_preview: body ? body.slice(0, 200) : ""
  });
}

function belle_chatwork_webhook_handle_(e) {
  const props = PropertiesService.getScriptProperties();
  const enabled = belle_chatwork_webhook_parseBool_(
    props.getProperty("BELLE_CHATWORK_WEBHOOK_ENABLED"),
    false
  );
  const routeParam = e && e.parameter && e.parameter.route ? String(e.parameter.route) : "";
  const paramKeys = e && e.parameter ? Object.keys(e.parameter) : [];
  const bodyString =
    e && e.postData && typeof e.postData.contents === "string" ? e.postData.contents : "";

  belle_chatwork_webhook_log_({
    phase: "CHATWORK_WEBHOOK_RECEIVED",
    route: routeParam,
    parameter_keys: paramKeys,
    body_length: bodyString.length,
    body_head: bodyString.slice(0, 200),
    has_signature:
      !!(e && e.parameter && e.parameter.chatwork_webhook_signature)
  });

  if (!enabled) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "WEBHOOK_DISABLED"
    });
    return ContentService.createTextOutput("ok");
  }

  const expectedRoute = belle_chatwork_webhook_getExpectedRoute_(props);
  if (routeParam !== expectedRoute) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "ROUTE_MISMATCH",
      route: routeParam,
      expected: expectedRoute
    });
    return ContentService.createTextOutput("ok");
  }

  if (!bodyString) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "BODY_MISSING"
    });
    return ContentService.createTextOutput("ok");
  }

  const tokenParam =
    e && e.parameter && e.parameter.token ? String(e.parameter.token) : "";
  const expectedToken = props.getProperty("BELLE_CHATWORK_WEBHOOK_TOKEN") || "";
  if (!expectedToken) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "TOKEN_MISSING"
    });
    return ContentService.createTextOutput("ok");
  }
  if (tokenParam !== expectedToken) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "TOKEN_MISMATCH"
    });
    return ContentService.createTextOutput("ok");
  }

  let payload = null;
  try {
    payload = JSON.parse(bodyString);
  } catch (e2) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "JSON_PARSE_ERROR",
      body_preview: bodyString.slice(0, 100)
    });
    return ContentService.createTextOutput("ok");
  }

  belle_chatwork_webhook_logEvent_(payload);
  return ContentService.createTextOutput("ok");
}

function doPost(e) {
  try {
    return belle_chatwork_webhook_handle_(e);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_ERROR",
      ok: false,
      message: message
    });
    return ContentService.createTextOutput("ok");
  }
}

function belle_chatwork_webhook_mock_test() {
  const props = PropertiesService.getScriptProperties();
  const route = belle_chatwork_webhook_getExpectedRoute_(props);
  const token = props.getProperty("BELLE_CHATWORK_WEBHOOK_TOKEN") || "";
  const mock = {
    parameter: {
      route: route,
      token: token
    },
    postData: {
      contents: JSON.stringify({
        webhook_event_type: "message_created",
        webhook_setting_id: "mock",
        webhook_event_time: Math.floor(Date.now() / 1000),
        room_id: 0,
        account_id: 0,
        message_id: 0,
        body: "[BELLE][MOCK] webhook test"
      })
    }
  };
  return belle_chatwork_webhook_handle_(mock);
}
