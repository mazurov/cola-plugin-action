#!/usr/bin/env bash

set -euo pipefail

# test-docs-from-releases.sh
# Test documentation generation from mock GitHub releases
# Creates fake release archives locally to simulate the releases-based workflow

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source common functions
source "${SCRIPT_DIR}/common.sh"

log_header "Testing Documentation Generation from Releases"

# Configuration
TEST_RELEASES_DIR="${PROJECT_ROOT}/build/test-releases"
TEST_OUTPUT_DIR="${PROJECT_ROOT}/build/docs-from-releases"
PLUGINS_DIR="${PLUGINS_DIR:-tests/valid}"

log_info "Plugins directory: $PLUGINS_DIR"
log_info "Mock releases directory: $TEST_RELEASES_DIR"
log_info "Output directory: $TEST_OUTPUT_DIR"

# Clean previous test data
if [[ -d "$TEST_RELEASES_DIR" ]]; then
    log_info "Cleaning previous test releases..."
    rm -rf "$TEST_RELEASES_DIR"
fi

if [[ -d "$TEST_OUTPUT_DIR" ]]; then
    log_info "Cleaning previous output..."
    rm -rf "$TEST_OUTPUT_DIR"
fi

# Create test directories
ensure_directory "$TEST_RELEASES_DIR"

# Step 1: Create mock release archives from test plugins
log_section "Creating Mock Release Archives"

VERSIONS=("1.0.0" "1.1.0" "1.2.0")

for plugin_dir in "$PROJECT_ROOT/$PLUGINS_DIR"/*/ ; do
    [[ ! -d "$plugin_dir" ]] && continue

    manifest_file="${plugin_dir}manifest.mf"

    if [[ ! -f "$manifest_file" ]]; then
        log_warning "Skipping $(basename "$plugin_dir") - no manifest"
        continue
    fi

    plugin_name=$(get_manifest_field "$manifest_file" "pkgName")

    if [[ -z "$plugin_name" ]]; then
        log_warning "Skipping $(basename "$plugin_dir") - no pkgName"
        continue
    fi

    log_info "Creating releases for: $plugin_name"

    # Backup original manifest
    manifest_backup=$(mktemp)
    cp "$manifest_file" "$manifest_backup"

    # Create archives for each version
    for version in "${VERSIONS[@]}"; do
        log_info "  Creating v${version}..."

        # Modify manifest version (supports both JSON and YAML)
        if command -v yq &> /dev/null; then
            yq eval ".version = \"$version\"" "$manifest_file" > "${manifest_file}.tmp"
            mv "${manifest_file}.tmp" "$manifest_file"
        elif command -v jq &> /dev/null; then
            # Fallback to jq for JSON-only
            jq --arg ver "$version" '.version = $ver' "$manifest_file" > "${manifest_file}.tmp"
            mv "${manifest_file}.tmp" "$manifest_file"
        else
            log_error "Neither yq nor jq found - cannot modify manifest"
            continue
        fi

        # Create archive name
        archive_name="${plugin_name}-${version}.tar.gz"
        archive_path="${TEST_RELEASES_DIR}/${archive_name}"

        # Create tar.gz (relative path from plugin_dir parent)
        (cd "$(dirname "$plugin_dir")" && tar -czf "$archive_path" "$(basename "$plugin_dir")")

        if [[ -f "$archive_path" ]]; then
            size_human=$(get_file_size_human "$archive_path")
            log_success "    Created: $archive_name ($size_human)"
        else
            log_error "    Failed to create archive"
        fi
    done

    # Restore original manifest
    mv "$manifest_backup" "$manifest_file"
    log_success "  Restored original manifest"
done

# Count created archives
archive_count=$(find "$TEST_RELEASES_DIR" -name "*.tar.gz" | wc -l)
log_success "Created $archive_count mock release archives"

if [[ $archive_count -eq 0 ]]; then
    die "No release archives created"
fi

# Step 2: Create mock releases JSON (simulate GitHub API response)
log_section "Creating Mock GitHub API Response"

releases_json_file="${TEST_RELEASES_DIR}/releases.json"

cat > "$releases_json_file" <<'EOF'
[]
EOF

# Build releases JSON from archives
release_num=1
for archive in "$TEST_RELEASES_DIR"/*.tar.gz; do
    [[ ! -f "$archive" ]] && continue

    archive_name=$(basename "$archive")
    archive_size=$(get_file_size "$archive")

    # Parse version from filename
    if [[ $archive_name =~ -([0-9]+\.[0-9]+\.[0-9]+)\.tar\.gz$ ]]; then
        version="${BASH_REMATCH[1]}"
        tag_name="v${version}"
    else
        tag_name="v1.0.${release_num}"
    fi

    # Create absolute file:// URL for local testing
    download_url="file://${archive}"

    # Add release to JSON
    jq --arg tag "$tag_name" \
       --arg created "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
       --arg name "$archive_name" \
       --arg url "$download_url" \
       --argjson size "$archive_size" \
       '. += [{
           tag_name: $tag,
           name: ("Release " + $tag),
           created_at: $created,
           assets: [{
               name: $name,
               browser_download_url: $url,
               size: $size
           }]
       }]' "$releases_json_file" > "${releases_json_file}.tmp"

    mv "${releases_json_file}.tmp" "$releases_json_file"

    ((release_num++))
done

release_count=$(jq '. | length' "$releases_json_file")
log_success "Created mock API response with $release_count releases"

# Pretty print releases JSON
log_info "Mock releases:"
jq -r '.[] | "  - \(.tag_name): \(.assets[0].name)"' "$releases_json_file"

# Step 3: Create a custom version of generate-docs-from-releases.sh for local testing
log_section "Preparing Test Script"

test_script="${TEST_RELEASES_DIR}/generate-docs-from-releases-test.sh"

# Copy the original script and modify it to use local releases
cp "${SCRIPT_DIR}/generate-docs-from-releases.sh" "$test_script"

# Fix the SCRIPT_DIR path since we're copying to a different location
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's|SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE\[0\]}")" && pwd)"|SCRIPT_DIR="'"${SCRIPT_DIR}"'"|' "$test_script"
else
    sed -i 's|SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE\[0\]}")" && pwd)"|SCRIPT_DIR="'"${SCRIPT_DIR}"'"|' "$test_script"
fi

# Replace the fetch_github_releases call with reading from local file
# Use | as delimiter since path contains /
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's|releases_json=$(fetch_github_releases.*)|releases_json=$(cat "'"${releases_json_file}"'")|' "$test_script"
else
    sed -i 's|releases_json=$(fetch_github_releases.*)|releases_json=$(cat "'"${releases_json_file}"'")|' "$test_script"
fi

# Replace download_release_asset with direct copy for file:// URLs
cat >> "$test_script" <<'SCRIPT_APPEND'

# Override download_release_asset for local file:// URLs
download_release_asset() {
    local download_url="$1"
    local output_file="$2"

    if [[ "$download_url" =~ ^file:// ]]; then
        local file_path="${download_url#file://}"
        if [[ -f "$file_path" ]]; then
            cp "$file_path" "$output_file"
            return 0
        fi
    fi

    return 1
}
SCRIPT_APPEND

chmod +x "$test_script"

log_success "Created test script: $test_script"

# Step 4: Run the documentation generator
log_section "Running Documentation Generator"

export GITHUB_REPOSITORY="test-org/test-repo"
export GITHUB_TOKEN="test-token-not-used"
export DOCS_BRANCH="gh-pages"
export DOCS_KEEP_VERSIONS="0"
export TEMPLATE_PATH="templates/plugin-page.html"
export ACTION_PATH="$PROJECT_ROOT"
export LOCAL_TEST_OUTPUT="$TEST_OUTPUT_DIR"

log_info "Running generator with test data..."
log_info "Output will be copied to: $LOCAL_TEST_OUTPUT"

# Run the test script
if bash "$test_script"; then
    log_success "Documentation generation completed"
else
    log_error "Documentation generation failed"
    exit 1
fi

# Step 5: Verify output
log_section "Verifying Generated Documentation"

if [[ ! -d "$TEST_OUTPUT_DIR" ]]; then
    log_error "Output directory not created"
    exit 1
fi

# Check for expected files
expected_files=(
    "index.html"
    "versions.json"
)

for file in "${expected_files[@]}"; do
    if [[ -f "$TEST_OUTPUT_DIR/$file" ]]; then
        log_success "  ✓ $file"
    else
        log_error "  ✗ $file (missing)"
    fi
done

# Check plugin directories
plugin_count=$(find "$TEST_OUTPUT_DIR/plugins" -maxdepth 1 -type d | tail -n +2 | wc -l)
log_info "Plugin directories: $plugin_count"

# List generated documentation
log_section "Generated Documentation Structure"

if command -v tree &> /dev/null; then
    tree -L 3 "$TEST_OUTPUT_DIR" | head -50
else
    find "$TEST_OUTPUT_DIR" -type f -name "*.html" -o -name "*.json" | sort | head -30
fi

# Summary
log_header "Test Complete"

echo "Test releases: $TEST_RELEASES_DIR"
echo "Generated docs: $TEST_OUTPUT_DIR"
echo ""
echo "To view locally:"
echo "  cd $TEST_OUTPUT_DIR"
echo "  python3 -m http.server 8000"
echo "  # Open http://localhost:8000"

exit 0
