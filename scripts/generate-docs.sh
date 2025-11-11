#!/usr/bin/env bash

set -euo pipefail

# generate-docs.sh
# Generates GitHub Pages documentation for Command Launcher plugins

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=./common-docs.sh
source "${SCRIPT_DIR}/common-docs.sh"

PLUGINS_DIR="${PLUGINS_DIR:-plugins}"
DOCS_BRANCH="${DOCS_BRANCH:-gh-pages}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
TEMPLATE_PATH="${TEMPLATE_PATH:-templates/plugin-page.html}"

log_info "Generating documentation for plugins in: $PLUGINS_DIR"
log_info "Documentation branch: $DOCS_BRANCH"

# Check if pandoc is available (optional but recommended)
if command -v pandoc &> /dev/null; then
    log_info "Pandoc detected - will use for better markdown conversion"
else
    log_warning "Pandoc not found - using basic markdown rendering"
fi

# Create temporary directory for gh-pages
DOCS_DIR=$(mktemp -d)
log_info "Using temporary directory: $DOCS_DIR"

# Initialize gh-pages branch
cd "$DOCS_DIR"
git init
git checkout -b "$DOCS_BRANCH"

# Create plugins directory
mkdir -p plugins

# Track plugin metadata for index
declare -a plugin_cards=()

# Process all plugins and generate documentation
log_section "Processing Plugins"
process_plugins_for_docs "${GITHUB_WORKSPACE:-$(pwd)}/$PLUGINS_DIR" "${GITHUB_WORKSPACE:-$(pwd)}/$TEMPLATE_PATH" plugin_cards

# Generate index page
log_info "Generating index page..."
generate_index_page "index.html" "Command Launcher Plugins" "Browse available plugins for Command Launcher" plugin_cards

# Commit and push to gh-pages
git config user.name "GitHub Actions"
git config user.email "actions@github.com"

git add .
git commit -m "Update plugin documentation" || echo "No changes to commit"

# Push to gh-pages branch if in GitHub Actions
if [[ -n "$GITHUB_TOKEN" && -n "$GITHUB_REPOSITORY" ]]; then
    log_info "Pushing to gh-pages branch..."

    git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
    git push -f origin "$DOCS_BRANCH"

    docs_url="https://$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f1).github.io/$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f2)/"

    github_output "url" "$docs_url"

    log_success "Documentation published to: $docs_url"
else
    log_warning "Skipping push - not in GitHub Actions context"
fi

# Cleanup
cd - > /dev/null
rm -rf "$DOCS_DIR"

echo ""
log_success "Documentation generation completed"
exit 0
