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
  ".program/manager/context_window_protocol.md",
  ".program/manager/control_board.md",
  ".program/manager/active_context.md",
  ".program/manager/templates/consult_track_prompt_template.md",
  ".program/manager/templates/consult_gatekeeper_prompt_template.md",
  ".program/manager/templates/implement_track_prompt_template.md",
  ".program/manager/templates/wave_prompt_packet_template.md",
  ".program/manager/registry/instruction_index.yaml",
  ".program/manager/registry/branch_worktree_map.yaml",
  ".program/manager/registry/evidence_index.yaml"
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
  "Do not push by default."
)
Add-Check -Name "manager_policy_safety" -Pass (Test-ContainsAll -Content $managerPolicy -Needles $policyNeedles) -Detail "manager safety contract"

$snapshotCount = @(Get-ChildItem ".program/manager/snapshots" -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne "README.md" }).Count
Add-Check -Name "snapshot_presence" -Pass ($snapshotCount -ge 1) -Detail "snapshot files: $snapshotCount"

$instructionIndex = Get-Content -Encoding utf8 ".program/manager/registry/instruction_index.yaml" -Raw
Add-Check -Name "instruction_registry_seeded" -Pass ($instructionIndex -match 'id:\s*".+"') -Detail "instruction id seeded"

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
