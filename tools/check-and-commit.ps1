param([Parameter(Mandatory=$true)][string]$Story,[Parameter(Mandatory=$true)][string]$Description,[ValidateSet('feat','fix','chore')][string]$CommitType='feat',[switch]$Amend)
$ErrorActionPreference='Stop'
$runtimeNode=if ($env:CLOUD_MENU_NODE) { $env:CLOUD_MENU_NODE } else { (Get-Command node -ErrorAction Stop).Source }
& $runtimeNode node_modules/typescript/bin/tsc --noEmit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $runtimeNode node_modules/eslint/bin/eslint.js .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $runtimeNode node_modules/vitest/vitest.mjs run --reporter=dot --reporter=json --outputFile=.artifacts/vitest.json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (Test-Path 'tests/browser/guest.spec.ts') {
  foreach ($appDirectory in @('apps/guest-pwa','apps/staff','apps/owner')) {
    if (Test-Path "$appDirectory/vite.config.ts") {
      Push-Location $appDirectory
      try { & $runtimeNode ../../node_modules/vite/bin/vite.js build; $buildExit=$LASTEXITCODE } finally { Pop-Location }
      if ($buildExit -ne 0) { exit $buildExit }
    }
  }
  & $runtimeNode tools/bundle-budget.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $env:PATH=(Split-Path $runtimeNode)+';'+$env:PATH
  $env:LOCAL_EDGE='1'
  & $runtimeNode node_modules/@playwright/test/cli.js test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if (Test-Path 'playwright.pages.config.ts') {
    & $runtimeNode node_modules/@playwright/test/cli.js test --config playwright.pages.config.ts
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
}
if ($Story -eq 'US-701') {
  & $runtimeNode tools/write-evidence.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
git -c core.autocrlf=false add .
if ($Amend) { git commit --amend --no-edit } else { git commit -m "${CommitType}($Story): $Description" }
