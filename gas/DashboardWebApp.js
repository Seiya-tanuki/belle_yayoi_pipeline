// @ts-check

// NOTE: Keep comments ASCII only.

function doGet() {
  var health = null;
  try {
    if (typeof belle_env_healthCheck_ === "function") {
      health = belle_env_healthCheck_({ ensure: true });
    }
  } catch (e) {
    health = {
      ok: true,
      reason: "NOT_READY",
      message: "Environment not ready.",
      data: {
        ready: false,
        diagnostics: [
          {
            item: "ENV_HEALTHCHECK",
            code: "EXCEPTION",
            detail: "Health check failed.",
            hint: "Retry after fixing Script Properties."
          }
        ]
      }
    };
  }
  if (!health) {
    health = {
      ok: true,
      reason: "NOT_READY",
      message: "Environment not ready.",
      data: {
        ready: false,
        diagnostics: [
          {
            item: "ENV_HEALTHCHECK",
            code: "MISSING",
            detail: "EnvHealthCheck unavailable.",
            hint: "Deploy gas/EnvHealthCheck.js."
          }
        ]
      }
    };
  }
  var template = HtmlService.createTemplateFromFile("Dashboard");
  template.bootHealth = health;
  return template.evaluate().setTitle("Belle Yayoi Pipeline Dashboard");
}
