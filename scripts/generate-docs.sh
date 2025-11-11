#!/usr/bin/env bash

set -euo pipefail

# generate-docs.sh
# Generates versioned GitHub Pages documentation from GitHub Release assets
# This script extracts manifests and READMEs from released plugin archives

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

log_info "Generating documentation from GitHub Releases"

# Delegate to releases-based documentation generator
exec bash "${SCRIPT_DIR}/generate-docs-from-releases.sh"
