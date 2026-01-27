// @ts-check

// NOTE: Keep comments ASCII only.

var BELLE_DASHBOARD_ROLE_ADMIN = "admin";
var BELLE_DASHBOARD_ROLE_USER = "user";
var BELLE_DASHBOARD_ROLE_NONE = "none";

function belle_dashboard_getIdentity_() {
  var actorEmail = "";
  var effectiveEmail = "";
  try {
    actorEmail = Session.getActiveUser().getEmail();
  } catch (e) {
    actorEmail = "";
  }
  try {
    effectiveEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {
    effectiveEmail = "";
  }
  actorEmail = String(actorEmail || "").trim();
  effectiveEmail = String(effectiveEmail || "").trim();
  if (!actorEmail) {
    return {
      actor_email: null,
      effective_email: effectiveEmail || null,
      role: BELLE_DASHBOARD_ROLE_NONE,
      reason: "ACTOR_EMAIL_UNAVAILABLE"
    };
  }
  var role = belle_dashboard_resolveRole_(actorEmail);
  var reason = role === BELLE_DASHBOARD_ROLE_NONE ? "NOT_ALLOWLISTED" : "OK";
  return {
    actor_email: actorEmail,
    effective_email: effectiveEmail || null,
    role: role,
    reason: reason
  };
}

function belle_dashboard_getAllowlist_(props, key) {
  var p = props || (typeof belle_cfg_getProps_ === "function" ? belle_cfg_getProps_() : PropertiesService.getScriptProperties());
  var raw = "";
  try {
    raw = p.getProperty(key) || "";
  } catch (e) {
    raw = "";
  }
  if (!raw) return [];
  var parts = String(raw).split(",");
  var out = [];
  var seen = {};
  for (var i = 0; i < parts.length; i++) {
    var item = String(parts[i] || "").trim().toLowerCase();
    if (!item) continue;
    if (seen[item]) continue;
    seen[item] = true;
    out.push(item);
  }
  return out;
}

function belle_dashboard_resolveRole_(email, props) {
  var normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return BELLE_DASHBOARD_ROLE_NONE;
  var p = props || (typeof belle_cfg_getProps_ === "function" ? belle_cfg_getProps_() : PropertiesService.getScriptProperties());
  var admins = belle_dashboard_getAllowlist_(p, "BELLE_DASHBOARD_ADMIN_EMAILS");
  if (admins.indexOf(normalized) >= 0) return BELLE_DASHBOARD_ROLE_ADMIN;
  var users = belle_dashboard_getAllowlist_(p, "BELLE_DASHBOARD_USER_EMAILS");
  if (users.indexOf(normalized) >= 0) return BELLE_DASHBOARD_ROLE_USER;
  return BELLE_DASHBOARD_ROLE_NONE;
}

function belle_dashboard_isAuthorized_(role, requiredRole) {
  var req = String(requiredRole || "").toLowerCase();
  if (!req || req === BELLE_DASHBOARD_ROLE_NONE) return role !== BELLE_DASHBOARD_ROLE_NONE;
  if (req === BELLE_DASHBOARD_ROLE_USER) {
    return role === BELLE_DASHBOARD_ROLE_USER || role === BELLE_DASHBOARD_ROLE_ADMIN;
  }
  if (req === BELLE_DASHBOARD_ROLE_ADMIN) return role === BELLE_DASHBOARD_ROLE_ADMIN;
  return false;
}
