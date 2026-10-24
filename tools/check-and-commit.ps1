param([Parameter(Mandatory=$true)][string]$Story,[Parameter(Mandatory=$true)][string]$Description,[switch]$Amend)
$ErrorActionPreference='Stop'
$runtimeNode=if ($env:CLOUD_MENU_NODE) { $env:CLOUD_MENU_NODE } else { (Get-Command node -ErrorAction Stop).Source }
& $runtimeNode node_modules/typescript/bin/tsc --noEmit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $runtimeNode node_modules/eslint/bin/eslint.js .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $runtimeNode node_modules/vitest/vitest.mjs run --reporter=dot --reporter=json --outputFile=.artifacts/vitest.json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (Test-Path 'tests/browser/guest.spec.ts') {
  $env:PATH=(Split-Path $runtimeNode)+';'+$env:PATH
  $env:LOCAL_EDGE='1'
  & $runtimeNode node_modules/@playwright/test/cli.js test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if ($Story -eq 'US-701') {
  & $runtimeNode tools/write-evidence.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
git -c core.autocrlf=false add .
if ($Amend) { git commit --amend --no-edit } else { git commit -m "feat($Story): $Description" }
