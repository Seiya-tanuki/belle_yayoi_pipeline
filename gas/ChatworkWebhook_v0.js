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

function belle_chatwork_webhook_log_(obj) {
  const msg = JSON.stringify(obj);
  console.log(msg);
  Logger.log(msg);
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
  if (!enabled) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "WEBHOOK_DISABLED"
    });
    return ContentService.createTextOutput("ok");
  }

  const expectedRoute = belle_chatwork_webhook_getExpectedRoute_(props);
  const route = e && e.parameter && e.parameter.route ? String(e.parameter.route) : "";
  if (route !== expectedRoute) {
    belle_chatwork_webhook_log_({
      phase: "CHATWORK_WEBHOOK_GUARD",
      ok: true,
      reason: "ROUTE_MISMATCH",
      route: route,
      expected: expectedRoute
    });
    return ContentService.createTextOutput("ok");
  }

  const bodyString =
    e && e.postData && typeof e.postData.contents === "string" ? e.postData.contents : "";
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
