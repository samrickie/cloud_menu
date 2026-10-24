param([Parameter(Mandatory=$true)][string]$Story,[Parameter(Mandatory=$true)][string]$Description)
$ErrorActionPreference='Stop'
$runtimeNode='C:/Users/e00922585/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $runtimeNode node_modules/typescript/bin/tsc --noEmit
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $runtimeNode node_modules/eslint/bin/eslint.js .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $runtimeNode node_modules/vitest/vitest.mjs run --reporter=dot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git -c core.autocrlf=false add .
git commit -m "feat($Story): $Description"
