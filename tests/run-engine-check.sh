#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/.engine-build
printf '{"type":"commonjs"}\n' > tests/.engine-build/package.json
tsc --module commonjs --target ES2022 --lib ES2022,DOM --skipLibCheck --outDir tests/.engine-build src/garden/{types,engine,layout,storage}.ts
node tests/engine-check.cjs
