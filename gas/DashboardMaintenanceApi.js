// @ts-check

// NOTE: Keep comments ASCII only.

function belle_dash_maint_getState_() {
  return belle_maint_getStateResult_();
}

function belle_dash_maint_enter_() {
  return belle_maint_quiesceAndEnter_();
}

function belle_dash_maint_exit_() {
  return belle_maint_exit_();
}

function belle_dash_maint_archiveLogs_() {
  return belle_logArchive_archiveLogs_();
}

function belle_dash_maint_exportRun_() {
  return belle_export_run_maintenance_();
}
