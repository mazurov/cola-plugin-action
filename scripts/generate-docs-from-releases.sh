#!/usr/bin/env bash

set -euo pipefail

# generate-docs-from-releases.sh
# Generates versioned GitHub Pages documentation from GitHub Release assets
# Fetches all released plugin archives, extracts manifests/READMEs, and generates docs

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=./common-docs.sh
source "${SCRIPT_DIR}/common-docs.sh"

# Environment variables
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
DOCS_BRANCH="${DOCS_BRANCH:-gh-pages}"
DOCS_KEEP_VERSIONS="${DOCS_KEEP_VERSIONS:-0}"
TEMPLATE_PATH="${TEMPLATE_PATH:-templates/plugin-page.html}"
ACTION_PATH="${ACTION_PATH:-}"

log_header "Generating Documentation from GitHub Releases"

# Validate required environment variables
if [[ -z "$GITHUB_REPOSITORY" ]]; then
    die "GITHUB_REPOSITORY environment variable is required"
fi

if [[ -z "$GITHUB_TOKEN" ]]; then
    die "GITHUB_TOKEN environment variable is required"
fi

log_info "Repository: $GITHUB_REPOSITORY"
log_info "Documentation branch: $DOCS_BRANCH"
log_info "Keep versions: $DOCS_KEEP_VERSIONS (0 = all)"

# Check required commands
check_required_commands curl jq tar || die "Missing required commands"

# Check if pandoc is available (optional but recommended)
if command -v pandoc &> /dev/null; then
    log_info "Pandoc detected - will use for better markdown conversion"
else
    log_warning "Pandoc not found - using basic markdown rendering"
fi

# Determine template directory and full template path
TEMPLATE_DIR=$(dirname "$TEMPLATE_PATH")
TEMPLATE_FULL_PATH="$TEMPLATE_PATH"

if [[ -n "$ACTION_PATH" ]]; then
    TEMPLATE_DIR="${ACTION_PATH}/templates"
    TEMPLATE_FULL_PATH="${ACTION_PATH}/$TEMPLATE_PATH"
elif [[ -n "${GITHUB_WORKSPACE:-}" ]]; then
    TEMPLATE_FULL_PATH="${GITHUB_WORKSPACE}/$TEMPLATE_PATH"
else
    # Fallback: assume relative to current working directory
    TEMPLATE_FULL_PATH="${PROJECT_ROOT:-$(pwd)}/$TEMPLATE_PATH"
fi

log_info "Template path: $TEMPLATE_FULL_PATH"

# Create temporary directories
WORK_DIR=$(mktemp -d)
DOCS_DIR=$(mktemp -d)
DOWNLOADS_DIR="${WORK_DIR}/downloads"
EXTRACT_DIR="${WORK_DIR}/extracted"

ensure_directory "$DOWNLOADS_DIR"
ensure_directory "$EXTRACT_DIR"

log_info "Working directory: $WORK_DIR"
log_info "Documentation output: $DOCS_DIR"

# Cleanup on exit
cleanup() {
    if [[ -d "$WORK_DIR" ]]; then
        rm -rf "$WORK_DIR"
    fi
}
trap cleanup EXIT

# Step 1: Fetch all releases from GitHub
log_section "Fetching Releases"

releases_json=$(fetch_github_releases "$GITHUB_REPOSITORY" "$GITHUB_TOKEN")

if [[ $? -ne 0 || -z "$releases_json" ]]; then
    die "Failed to fetch releases from GitHub"
fi

# Step 2: Filter and list plugin assets
log_section "Identifying Plugin Assets"

plugin_releases=$(get_plugin_assets "$releases_json")
release_count=$(echo "$plugin_releases" | jq '. | length')

if [[ "$release_count" == "0" ]]; then
    log_warning "No plugin archives found in releases"
    die "No plugin assets to process"
fi

log_success "Found $release_count releases with plugin archives"

# Step 3: Download and process each plugin asset
log_section "Processing Plugin Archives"

# Store plugin data: plugin_name -> versions -> {version, manifest_path, readme_path, tag_name}
declare -A PLUGIN_DATA

# Process each release
echo "$plugin_releases" | jq -c '.[]' | while IFS= read -r release; do
    tag_name=$(echo "$release" | jq -r '.tag_name')
    assets=$(echo "$release" | jq -c '.assets')

    log_info "Processing release: $tag_name"

    # Process each asset in this release
    echo "$assets" | jq -c '.[]' | while IFS= read -r asset; do
        asset_name=$(echo "$asset" | jq -r '.name')
        download_url=$(echo "$asset" | jq -r '.download_url')

        log_info "  Asset: $asset_name"

        # Parse plugin name and version from filename
        plugin_info=$(parse_plugin_from_archive "$asset_name")

        if [[ $? -ne 0 ]]; then
            log_warning "  Skipping - could not parse plugin info"
            continue
        fi

        plugin_name=$(echo "$plugin_info" | cut -d'|' -f1)
        plugin_version=$(echo "$plugin_info" | cut -d'|' -f2)

        log_info "    Plugin: $plugin_name v$plugin_version"

        # Download archive
        archive_path="${DOWNLOADS_DIR}/${asset_name}"

        if [[ -f "$archive_path" ]]; then
            log_info "    Using cached download"
        else
            log_info "    Downloading..."
            download_release_asset "$download_url" "$archive_path" "$GITHUB_TOKEN"

            if [[ $? -ne 0 ]]; then
                log_error "    Failed to download"
                continue
            fi

            size_human=$(get_file_size_human "$archive_path")
            log_success "    Downloaded: $size_human"
        fi

        # Extract manifest and README
        extract_path="${EXTRACT_DIR}/${plugin_name}/${plugin_version}"
        ensure_directory "$extract_path"

        log_info "    Extracting files..."
        extract_archive_files "$archive_path" "$extract_path" "manifest.mf" "README.md"

        if [[ $? -ne 0 ]]; then
            log_error "    Failed to extract"
            continue
        fi

        # Find extracted manifest
        manifest_path=$(find "$extract_path" -name "manifest.mf" -type f | head -1)

        if [[ -z "$manifest_path" || ! -f "$manifest_path" ]]; then
            log_error "    Manifest not found in archive"
            continue
        fi

        # Validate manifest
        manifest_pkg_name=$(get_manifest_field "$manifest_path" "pkgName")
        manifest_version=$(get_manifest_field "$manifest_path" "version")

        if [[ -z "$manifest_pkg_name" || -z "$manifest_version" ]]; then
            log_error "    Invalid manifest - missing required fields"
            continue
        fi

        # Verify version matches
        if [[ "$manifest_version" != "$plugin_version" ]]; then
            log_warning "    Version mismatch: filename=$plugin_version, manifest=$manifest_version"
            log_info "    Using manifest version: $manifest_version"
            plugin_version="$manifest_version"
        fi

        # Find README
        readme_path=$(find "$extract_path" -name "README.md" -type f | head -1)

        if [[ -z "$readme_path" || ! -f "$readme_path" ]]; then
            log_warning "    README.md not found"
            readme_path=""
        fi

        # Store plugin data in JSON file (arrays don't work well across subshells)
        plugin_data_file="${WORK_DIR}/plugin_${manifest_pkg_name}.json"

        if [[ ! -f "$plugin_data_file" ]]; then
            echo '{"plugin_name":"'"$manifest_pkg_name"'","versions":[]}' > "$plugin_data_file"
        fi

        # Add this version to the plugin data
        jq --arg version "$plugin_version" \
           --arg manifest "$manifest_path" \
           --arg readme "$readme_path" \
           --arg tag "$tag_name" \
           '.versions += [{version: $version, manifest: $manifest, readme: $readme, tag: $tag}]' \
           "$plugin_data_file" > "${plugin_data_file}.tmp"

        mv "${plugin_data_file}.tmp" "$plugin_data_file"

        log_success "    Processed: $manifest_pkg_name v$plugin_version"
    done
done

# Step 4: Initialize gh-pages branch
log_section "Initializing Documentation Branch"

cd "$DOCS_DIR"

# Initialize git repository
git init -q
git checkout -b "$DOCS_BRANCH"

# Configure git
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# Create initial versions.json
echo '{"plugins":{},"generated_at":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' > versions.json

log_success "Initialized documentation branch"

# Step 5: Generate documentation for each plugin
log_section "Generating Plugin Documentation"

plugin_data_files=("${WORK_DIR}"/plugin_*.json)

if [[ ${#plugin_data_files[@]} -eq 0 || ! -f "${plugin_data_files[0]}" ]]; then
    die "No plugin data files found - no plugins processed"
fi

for plugin_data_file in "${plugin_data_files[@]}"; do
    [[ ! -f "$plugin_data_file" ]] && continue

    plugin_name=$(jq -r '.plugin_name' "$plugin_data_file")
    versions_array=$(jq -c '.versions' "$plugin_data_file")

    log_info "Generating docs for: $plugin_name"

    # Get all versions for this plugin
    versions=()
    while IFS= read -r version_obj; do
        version=$(echo "$version_obj" | jq -r '.version')
        versions+=("$version")
    done < <(echo "$versions_array" | jq -c '.[]')

    # Sort versions (newest first)
    sorted_versions=($(sort_versions "${versions[@]}"))

    log_info "  Versions: ${sorted_versions[*]}"

    # Create plugin directory
    plugin_docs_dir="plugins/${plugin_name}"
    ensure_directory "$plugin_docs_dir"

    # Generate documentation for each version
    for version in "${sorted_versions[@]}"; do
        log_info "  Generating v${version}..."

        # Find version data
        version_data=$(echo "$versions_array" | jq -c --arg v "$version" '.[] | select(.version == $v)' | head -1)

        if [[ -z "$version_data" ]]; then
            log_error "    Version data not found"
            continue
        fi

        manifest_path=$(echo "$version_data" | jq -r '.manifest')
        readme_path=$(echo "$version_data" | jq -r '.readme')

        # Create version directory
        version_docs_dir="${plugin_docs_dir}/v${version}"
        ensure_directory "$version_docs_dir"

        # Find plugin directory (parent of manifest)
        plugin_dir=$(dirname "$manifest_path")

        # Generate plugin page
        generate_plugin_page "$manifest_path" \
                            "$plugin_dir/" \
                            "$TEMPLATE_FULL_PATH" \
                            "${version_docs_dir}/index.html" \
                            "$TEMPLATE_DIR"

        log_success "    Generated: ${version_docs_dir}/index.html"
    done

    # Update latest directory (point to newest version)
    latest_version="${sorted_versions[0]}"
    latest_docs_dir="${plugin_docs_dir}/latest"
    ensure_directory "$latest_docs_dir"
    cp "${plugin_docs_dir}/v${latest_version}/index.html" "${latest_docs_dir}/index.html"
    log_success "  Updated latest/ -> v${latest_version}"

    # Update versions.json
    update_versions_json "." "$plugin_name" "${sorted_versions[@]}"

    # Generate version index page
    version_index_template="${TEMPLATE_DIR}/version-index.html"
    if [[ -f "$version_index_template" ]]; then
        generate_version_index_page "$plugin_name" \
            "${sorted_versions[@]}" \
            --latest "${latest_version}" \
            --output "${plugin_docs_dir}/index.html" \
            --template "$version_index_template"
        log_success "  Generated version index: ${plugin_docs_dir}/index.html"
    else
        log_warning "  Version index template not found: $version_index_template"
    fi

    # Apply version cleanup if configured
    if [[ "$DOCS_KEEP_VERSIONS" -gt 0 ]]; then
        cleanup_old_versions "." "$plugin_name" "$DOCS_KEEP_VERSIONS"
    fi
done

# Step 6: Generate root index page
log_section "Generating Root Index"

# Get all plugins from versions.json
plugins_list=$(jq -r '.plugins | to_entries | map({name: .key, latest: .value.latest, versions: .value.versions}) | @json' versions.json)

# Generate index page
if [[ -f "$TEMPLATE_FULL_PATH" ]]; then
    # Use process_plugins_for_docs function to create index
    # Create a temporary plugins list file
    temp_plugins_list=$(mktemp)
    jq -r '.plugins | to_entries[] | "\(.key)|\(.value.latest)|\(.value.versions[0])|Plugin"' versions.json > "$temp_plugins_list"

    # Generate simple index
    cat > index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Command Launcher Plugins</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem 0;
            text-align: center;
        }
        h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .container { max-width: 1200px; margin: 2rem auto; padding: 0 2rem; }
        .plugin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
        .plugin-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .plugin-card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .plugin-name { font-size: 1.3rem; font-weight: 600; color: #667eea; margin-bottom: 0.5rem; }
        .plugin-version { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
        .plugin-link { display: inline-block; color: #667eea; text-decoration: none; font-weight: 500; }
        .plugin-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <header>
        <h1>Command Launcher Plugins</h1>
        <p>Documentation for all available plugins</p>
    </header>
    <div class="container">
        <div class="plugin-grid">
EOF

    jq -r '.plugins | to_entries[] | "<div class=\"plugin-card\"><div class=\"plugin-name\">\(.key)</div><div class=\"plugin-version\">Latest: v\(.value.latest) (\(.value.versions | length) versions)</div><a href=\"plugins/\(.key)/\" class=\"plugin-link\">View Documentation →</a></div>"' versions.json >> index.html

    cat >> index.html <<'EOF'
        </div>
    </div>
</body>
</html>
EOF

    rm -f "$temp_plugins_list"
fi

log_success "Generated: index.html"

# Step 7: Commit and push to gh-pages
log_section "Publishing Documentation"

# Add all generated files
git add .
git commit -q -m "Generate documentation from releases [$(date -u +"%Y-%m-%d %H:%M:%S UTC")]"

log_success "Documentation committed"

# Check if LOCAL_TEST_OUTPUT is set (for local testing)
if [[ -n "${LOCAL_TEST_OUTPUT:-}" ]]; then
    log_info "LOCAL_TEST_OUTPUT set - copying docs to: $LOCAL_TEST_OUTPUT"

    # Create output directory
    mkdir -p "$LOCAL_TEST_OUTPUT"

    # Copy all generated files to local output
    cp -r . "$LOCAL_TEST_OUTPUT/"

    log_success "Documentation copied to: $LOCAL_TEST_OUTPUT"
    log_info "To view locally:"
    log_info "  cd $LOCAL_TEST_OUTPUT"
    log_info "  python3 -m http.server 8000"

elif [[ -n "${GITHUB_REPOSITORY:-}" && -n "${GITHUB_TOKEN:-}" && "${GITHUB_TOKEN}" != "test-token-not-used" ]]; then
    repo_url="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

    log_info "Pushing to gh-pages branch..."

    # Force push to gh-pages (complete replacement)
    git push -f "$repo_url" "$DOCS_BRANCH" 2>&1 | grep -v "x-access-token" || true

    if [[ $? -eq 0 ]]; then
        log_success "Documentation pushed to gh-pages"

        # Construct GitHub Pages URL
        owner=$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f1)
        repo=$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f2)
        docs_url="https://${owner}.github.io/${repo}/"

        log_success "Documentation URL: $docs_url"

        # Output for GitHub Actions
        github_output "url" "$docs_url"
    else
        log_error "Failed to push documentation"
    fi
else
    log_info "Local testing mode - skipping git push"
    log_info "Documentation generated in: $DOCS_DIR"
fi

# Summary
log_header "Documentation Generation Complete"

plugin_count=$(jq '.plugins | length' versions.json)
echo "Generated documentation for $plugin_count plugins from GitHub Releases"
echo ""
echo "Plugins:"
jq -r '.plugins | to_entries[] | "  - \(.key): \(.value.versions | length) versions (latest: v\(.value.latest))"' versions.json

exit 0
