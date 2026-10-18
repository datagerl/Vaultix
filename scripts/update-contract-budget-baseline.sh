#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

UPDATE_BUDGET_BASELINE=1 cargo test --manifest-path apps/onchain/Cargo.toml budget -- --nocapture
