$ErrorActionPreference = "Stop"

function Test-ContainsAll {
  param(
    [string]$Content,
    [string[]]$Needles
  )
  foreach ($n in $Needles) {
    if ($Content -notmatch [regex]::Escape($n)) {
      return $false
    }
  }
  return $true
}

$script:checks = @()

function Add-Check {
  param(
    [string]$Name,
    [bool]$Pass,
    [string]$Detail
  )
  $script:checks += [pscustomobject]@{
    name = $Name
    pass = $Pass
    detail = $Detail
  }
}

$requiredPaths = @(
  ".lanes/manager/AGENTS.md",
  ".agents/skills/manager-program-planner/SKILL.md",
  ".program/manager/context_window_protocol.md",
  ".program/manager/control_board.md",
  ".program/manager/active_context.md",
  ".program/manager/templates/program_foundation_template.md",
  ".program/manager/templates/track_lock_matrix_template.yaml",
  ".program/manager/templates/gate_contract_template.yaml",
  ".program/manager/templates/assumption_ledger_template.yaml",
  ".program/manager/templates/consult_track_prompt_template.md",
  ".program/manager/templates/consult_gatekeeper_prompt_template.md",
  ".program/manager/templates/implement_track_prompt_template.md",
  ".program/manager/templates/wave_prompt_packet_template.md",
  ".program/manager/registry/instruction_index.yaml",
  ".program/manager/registry/branch_worktree_map.yaml",
  ".program/manager/registry/evidence_index.yaml",
  ".program/manager/registry/track_lock_matrix.yaml",
  ".program/manager/registry/gate_contract.yaml",
  ".program/manager/registry/assumption_ledger.yaml"
)

$missing = @()
foreach ($p in $requiredPaths) {
  if (-not (Test-Path $p)) { $missing += $p }
}
Add-Check -Name "required_paths" -Pass ($missing.Count -eq 0) -Detail ($(if ($missing.Count -eq 0) { "ok" } else { "missing: " + ($missing -join ", ") }))

$implTemplate = Get-Content -Encoding utf8 ".program/manager/templates/implement_track_prompt_template.md" -Raw
$implNeedles = @(
  "Mandatory precondition",
  "Mandatory conflict-prevention overlay",
  "BLOCKER: SCOPE_CONFLICT",
  "Required verification",
  "Final boundary check",
  "Do not push.",
  "Do not run"
)
Add-Check -Name "implement_template_fidelity" -Pass (Test-ContainsAll -Content $implTemplate -Needles $implNeedles) -Detail "implement prompt required blocks"

$gateTemplate = Get-Content -Encoding utf8 ".program/manager/templates/consult_gatekeeper_prompt_template.md" -Raw
$gateNeedles = @(
  "Spec-driven gate",
  "Test-driven gate",
  "Data-driven gate",
  "Conflict prevention",
  "Accept/Revise decision.",
  "Exact required fixes if Revise.",
  "GO / HOLD"
)
Add-Check -Name "gatekeeper_template_fidelity" -Pass (Test-ContainsAll -Content $gateTemplate -Needles $gateNeedles) -Detail "gatekeeper prompt required blocks"

$protocol = Get-Content -Encoding utf8 ".program/manager/context_window_protocol.md" -Raw
$protocolNeedles = @(
  "Snapshot cadence",
  "Recovery procedure",
  "Path-based instruction operation",
  "Minimum snapshot payload"
)
Add-Check -Name "context_protocol_completeness" -Pass (Test-ContainsAll -Content $protocol -Needles $protocolNeedles) -Detail "protocol core sections"

$managerPolicy = Get-Content -Encoding utf8 ".lanes/manager/AGENTS.md" -Raw
$policyNeedles = @(
  "External context window protocol (required)",
  "BLOCKER: SCOPE_CONFLICT",
  "Do not merge into",
  "Do not push by default.",
  "project_type",
  "change_vectors"
)
Add-Check -Name "manager_policy_safety" -Pass (Test-ContainsAll -Content $managerPolicy -Needles $policyNeedles) -Detail "manager safety contract"

$plannerTemplate = Get-Content -Encoding utf8 ".program/manager/templates/program_foundation_template.md" -Raw
$plannerNeedles = @(
  "project_type: <free-form text>",
  "change_vectors:",
  "Boundary Proof Standard",
  "Launch Decision"
)
Add-Check -Name "program_foundation_template_contract" -Pass (Test-ContainsAll -Content $plannerTemplate -Needles $plannerNeedles) -Detail "planner template required blocks"

$gateContractTemplate = Get-Content -Encoding utf8 ".program/manager/templates/gate_contract_template.yaml" -Raw
$gateContractNeedles = @(
  "tracked",
  "staged",
  "unstaged",
  "untracked",
  "report_allowlist",
  ".spec/reports/*"
)
Add-Check -Name "gate_contract_template_completeness" -Pass (Test-ContainsAll -Content $gateContractTemplate -Needles $gateContractNeedles) -Detail "gate contract coverage and report allowlist"

$snapshotCount = @(Get-ChildItem ".program/manager/snapshots" -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "README.md" }).Count
Add-Check -Name "snapshot_presence" -Pass ($snapshotCount -ge 1) -Detail "snapshot files: $snapshotCount"

$instructionIndex = Get-Content -Encoding utf8 ".program/manager/registry/instruction_index.yaml" -Raw
Add-Check -Name "instruction_registry_seeded" -Pass ($instructionIndex -match 'id:\s*".+"') -Detail "instruction id seeded"

$assumptionLedger = Get-Content -Encoding utf8 ".program/manager/registry/assumption_ledger.yaml" -Raw
Add-Check -Name "assumption_ledger_expiry" -Pass ($assumptionLedger -match 'expiry:\s*"[0-9]{4}-[0-9]{2}-[0-9]{2}"') -Detail "assumption expiry fields present"

$foundationReports = @(Get-ChildItem ".program/manager/reports" -File -Filter "P-*.md" -ErrorAction SilentlyContinue)
$foundationPresent = $foundationReports.Count -ge 1
Add-Check -Name "foundation_report_presence" -Pass $foundationPresent -Detail "foundation reports: $($foundationReports.Count)"

if ($foundationPresent) {
  $latestFoundation = ($foundationReports | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
  $latestContent = Get-Content -Encoding utf8 $latestFoundation.FullName -Raw
  $foundationNeedles = @(
    "project_type:",
    "change_vectors:",
    "Boundary Proof Standard",
    "Launch Decision"
  )
  Add-Check -Name "foundation_report_contract" -Pass (Test-ContainsAll -Content $latestContent -Needles $foundationNeedles) -Detail "latest foundation report: $($latestFoundation.Name)"
}

$total = $script:checks.Count
$passed = @($script:checks | Where-Object { $_.pass }).Count
$score10 = [math]::Round((10.0 * $passed / [math]::Max(1, $total)), 2)

Write-Host "MANAGER_QUALITY_GATE"
Write-Host ("CHECKS_PASS:{0}/{1}" -f $passed, $total)
Write-Host ("SCORE_10:{0}" -f $score10)
foreach ($c in $script:checks) {
  $flag = if ($c.pass) { "PASS" } else { "FAIL" }
  Write-Host ("[{0}] {1} :: {2}" -f $flag, $c.name, $c.detail)
}

if ($passed -ne $total) { exit 1 }
