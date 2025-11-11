#!/usr/bin/env bash

# common.sh
# Common functions and utilities for Cola Plugin Action scripts

# Color codes for terminal output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*" >&2
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

log_header() {
    echo ""
    echo "================================"
    echo "$*"
    echo "================================"
}

log_section() {
    echo ""
    echo "$*"
    echo "$(printf '=%.0s' $(seq 1 ${#1}))"
}

# Manifest parsing function
# Usage: get_manifest_field <manifest_file> <field_name>
# Supports JSON and YAML formats (Command Launcher specification)
# Uses yq for parsing - it handles both JSON and YAML natively
# Field mappings:
#   - pkgName, version, cmds -> top-level fields
#   - author, license, homepage, repository, tags -> _metadata object
#   - command_name, command_type, command_short -> first command in cmds array
get_manifest_field() {
    local manifest_file="$1"
    local field_name="$2"

    if [[ ! -f "$manifest_file" ]]; then
        return 1
    fi

    if ! command -v yq &> /dev/null; then
        echo "ERROR: yq is required for manifest parsing" >&2
        return 1
    fi

    # Use yq to parse both JSON and YAML (auto-detects format)
    local value=""
    case "$field_name" in
        "pkgName"|"version")
            value=$(yq eval ".${field_name} // \"\"" "$manifest_file" 2>/dev/null)
            ;;
        "author"|"license"|"homepage"|"repository")
            value=$(yq eval "._metadata.${field_name} // \"\"" "$manifest_file" 2>/dev/null)
            ;;
        "tags")
            value=$(yq eval '._metadata.tags // [] | join(", ")' "$manifest_file" 2>/dev/null)
            ;;
        "command_name")
            value=$(yq eval '.cmds[0].name // ""' "$manifest_file" 2>/dev/null)
            ;;
        "command_type")
            value=$(yq eval '.cmds[0].type // ""' "$manifest_file" 2>/dev/null)
            ;;
        "command_short"|"description")
            value=$(yq eval '.cmds[0].short // ""' "$manifest_file" 2>/dev/null)
            ;;
        "command_long")
            value=$(yq eval '.cmds[0].long // ""' "$manifest_file" 2>/dev/null)
            ;;
        "executable")
            value=$(yq eval '.cmds[0].executable // ""' "$manifest_file" 2>/dev/null)
            ;;
        "cmds_count")
            value=$(yq eval '.cmds | length' "$manifest_file" 2>/dev/null)
            ;;
        *)
            # Try to get from top level first, then from _metadata
            value=$(yq eval ".${field_name} // ._metadata.${field_name} // \"\"" "$manifest_file" 2>/dev/null)
            ;;
    esac

    echo "$value"
}

# Validation functions
validate_semver() {
    local version="$1"
    # Semantic versioning regex: MAJOR.MINOR.PATCH with optional pre-release/build metadata
    if [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9._-]+)?(\+[a-zA-Z0-9._-]+)?$ ]]; then
        return 0
    else
        return 1
    fi
}

validate_command_name() {
    local cmd_name="$1"
    # Lowercase alphanumeric with hyphens
    if [[ $cmd_name =~ ^[a-z0-9-]+$ ]]; then
        return 0
    else
        return 1
    fi
}

# String manipulation
sanitize_name() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g'
}

escape_html() {
    echo "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&#39;/g'
}

# Safe template replacement (handles special characters and multiline in replacement string)
template_replace() {
    local template="$1"
    local placeholder="$2"
    local replacement="$3"

    # Use Python for robust replacement via temporary files
    local temp_template=$(mktemp)
    local temp_replacement=$(mktemp)

    echo "$template" > "$temp_template"
    echo -n "$replacement" > "$temp_replacement"

    python3 - "$placeholder" "$temp_template" "$temp_replacement" <<'PYPROG'
import sys
placeholder = sys.argv[1]
with open(sys.argv[2], 'r') as f:
    template = f.read()
with open(sys.argv[3], 'r') as f:
    replacement = f.read()
print(template.replace(placeholder, replacement), end='')
PYPROG

    rm -f "$temp_template" "$temp_replacement"
}

# File operations
get_file_size() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "0"
        return 1
    fi

    if command -v stat &> /dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            stat -f%z "$file"
        else
            stat -c%s "$file"
        fi
    else
        echo "0"
        return 1
    fi
}

get_file_size_human() {
    local file="$1"
    local size_bytes
    size_bytes=$(get_file_size "$file")

    if [[ $? -ne 0 ]]; then
        echo "unknown"
        return 1
    fi

    if command -v numfmt &> /dev/null; then
        numfmt --to=iec-i --suffix=B "$size_bytes"
    elif command -v bc &> /dev/null; then
        local size_mb
        size_mb=$(echo "scale=2; $size_bytes / 1048576" | bc)
        echo "${size_mb}MB"
    else
        echo "${size_bytes}B"
    fi
}

# Checksum operations
generate_checksum() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        return 1
    fi

    if command -v sha256sum &> /dev/null; then
        sha256sum "$file" | awk '{print $1}'
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" | awk '{print $1}'
    else
        log_warning "No checksum utility available (sha256sum or shasum)"
        return 1
    fi
}

verify_checksum() {
    local file="$1"
    local expected_checksum="$2"
    local calculated_checksum

    calculated_checksum=$(generate_checksum "$file")

    if [[ $? -ne 0 ]]; then
        return 1
    fi

    if [[ "$calculated_checksum" == "$expected_checksum" ]]; then
        return 0
    else
        return 1
    fi
}

# GitHub Actions integration
github_output() {
    local key="$1"
    local value="$2"

    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        echo "${key}=${value}" >> "$GITHUB_OUTPUT"
    fi
}

github_output_json_array() {
    local key="$1"
    shift
    local items=("$@")

    local json_array="["
    for i in "${!items[@]}"; do
        if [[ $i -gt 0 ]]; then
            json_array+=","
        fi
        # Escape quotes in item
        local escaped_item="${items[$i]//\"/\\\"}"
        json_array+="\"${escaped_item}\""
    done
    json_array+="]"

    github_output "$key" "$json_array"
}

# Dependency checks
check_command() {
    local cmd="$1"
    local package="${2:-$cmd}"

    if ! command -v "$cmd" &> /dev/null; then
        log_error "Required command not found: $cmd"
        log_info "Install with: sudo apt-get install $package (Ubuntu/Debian)"
        log_info "         or: brew install $package (macOS)"
        return 1
    fi

    return 0
}

check_required_commands() {
    local missing=0

    for cmd in "$@"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            ((missing++))
        fi
    done

    if [[ $missing -gt 0 ]]; then
        log_error "Missing $missing required command(s)"
        return 1
    fi

    return 0
}

# Directory operations
ensure_directory() {
    local dir="$1"

    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
        if [[ $? -eq 0 ]]; then
            log_success "Created directory: $dir"
        else
            log_error "Failed to create directory: $dir"
            return 1
        fi
    fi

    return 0
}

# Plugin directory iteration
# Usage: for_each_plugin <plugins_dir> <callback_function>
# Callback receives: plugin_dir, plugin_name, manifest_file
for_each_plugin() {
    local plugins_dir="$1"
    local callback="$2"

    if [[ ! -d "$plugins_dir" ]]; then
        log_error "Directory does not exist: $plugins_dir"
        return 1
    fi

    for plugin_dir in "$plugins_dir"/*/ ; do
        [[ ! -d "$plugin_dir" ]] && continue

        local plugin_name
        plugin_name=$(basename "$plugin_dir")
        local manifest_file="${plugin_dir}manifest.mf"

        # Call the callback function
        "$callback" "$plugin_dir" "$plugin_name" "$manifest_file"
    done
}

# Summary counter
declare -g -A SUMMARY_COUNTERS

init_summary() {
    SUMMARY_COUNTERS=()
}

increment_counter() {
    local counter_name="$1"
    local increment="${2:-1}"

    if [[ -z "${SUMMARY_COUNTERS[$counter_name]+x}" ]]; then
        SUMMARY_COUNTERS[$counter_name]=0
    fi

    SUMMARY_COUNTERS[$counter_name]=$((SUMMARY_COUNTERS[$counter_name] + increment))
}

get_counter() {
    local counter_name="$1"
    if [[ -z "${SUMMARY_COUNTERS[$counter_name]+x}" ]]; then
        echo "0"
    else
        echo "${SUMMARY_COUNTERS[$counter_name]}"
    fi
}

print_summary() {
    local title="$1"

    log_header "$title"

    for counter_name in "${!SUMMARY_COUNTERS[@]}"; do
        local count="${SUMMARY_COUNTERS[$counter_name]}"
        echo "${counter_name}: ${count}"
    done
}

# Error handling
die() {
    log_error "$*"
    exit 1
}

# Manifest validation helpers
validate_required_fields() {
    local manifest_file="$1"
    shift
    local required_fields=("$@")
    local has_errors=false

    for field in "${required_fields[@]}"; do
        local value
        value=$(get_manifest_field "$manifest_file" "$field")

        if [[ -z "$value" ]]; then
            log_error "Missing required field: $field"
            has_errors=true
        else
            log_success "$field: $value"
        fi
    done

    if [[ $has_errors == true ]]; then
        return 1
    fi

    return 0
}

# GitHub API functions
# Fetch all releases from a GitHub repository
# Usage: fetch_github_releases <owner/repo> <github_token>
# Returns: JSON array of releases
fetch_github_releases() {
    local repo="$1"
    local token="${2:-$GITHUB_TOKEN}"
    local page=1
    local per_page=100
    local all_releases="[]"

    if [[ -z "$token" ]]; then
        log_error "GitHub token is required for fetching releases"
        return 1
    fi

    log_info "Fetching releases from $repo..."

    while true; do
        local url="https://api.github.com/repos/${repo}/releases?page=${page}&per_page=${per_page}"

        local response
        response=$(curl -s -H "Authorization: token ${token}" \
                       -H "Accept: application/vnd.github.v3+json" \
                       "$url")

        if [[ $? -ne 0 ]]; then
            log_error "Failed to fetch releases from GitHub API"
            return 1
        fi

        # Check if response is an error
        local error_message
        error_message=$(echo "$response" | jq -r '.message // empty' 2>/dev/null)
        if [[ -n "$error_message" ]]; then
            log_error "GitHub API error: $error_message"
            return 1
        fi

        # Get count of releases in this page
        local count
        count=$(echo "$response" | jq '. | length' 2>/dev/null)

        if [[ -z "$count" || "$count" == "0" ]]; then
            break
        fi

        # Merge with existing releases
        all_releases=$(jq -s '.[0] + .[1]' <(echo "$all_releases") <(echo "$response"))

        log_info "  Fetched page $page ($count releases)"

        # If less than per_page, we've reached the end
        if [[ $count -lt $per_page ]]; then
            break
        fi

        ((page++))
    done

    local total_count
    total_count=$(echo "$all_releases" | jq '. | length')
    log_success "Fetched $total_count releases total"

    echo "$all_releases"
}

# Download a release asset from GitHub
# Usage: download_release_asset <download_url> <output_file> <github_token>
download_release_asset() {
    local download_url="$1"
    local output_file="$2"
    local token="${3:-$GITHUB_TOKEN}"
    local max_retries=3
    local retry=0

    while [[ $retry -lt $max_retries ]]; do
        if [[ -n "$token" ]]; then
            curl -sL -H "Authorization: token ${token}" \
                 -H "Accept: application/octet-stream" \
                 -o "$output_file" \
                 "$download_url"
        else
            curl -sL -o "$output_file" "$download_url"
        fi

        if [[ $? -eq 0 && -f "$output_file" ]]; then
            local size
            size=$(get_file_size "$output_file")
            if [[ $size -gt 0 ]]; then
                return 0
            fi
        fi

        ((retry++))
        log_warning "Download failed, retry $retry/$max_retries"
        sleep 2
    done

    log_error "Failed to download after $max_retries attempts"
    return 1
}

# Extract specific files from a tar.gz archive
# Usage: extract_archive_files <archive> <output_dir> [file_patterns...]
# Example: extract_archive_files plugin.tar.gz /tmp/extract "manifest.mf" "README.md"
extract_archive_files() {
    local archive="$1"
    local output_dir="$2"
    shift 2
    local patterns=("$@")

    if [[ ! -f "$archive" ]]; then
        log_error "Archive not found: $archive"
        return 1
    fi

    ensure_directory "$output_dir"

    # Extract entire archive first (safer than selective extraction)
    tar -xzf "$archive" -C "$output_dir" 2>/dev/null

    if [[ $? -ne 0 ]]; then
        log_error "Failed to extract archive: $archive"
        return 1
    fi

    # Find the extracted files
    local found_files=()
    for pattern in "${patterns[@]}"; do
        while IFS= read -r -d '' file; do
            found_files+=("$file")
        done < <(find "$output_dir" -name "$pattern" -maxdepth 3 -print0 2>/dev/null)
    done

    if [[ ${#found_files[@]} -eq 0 ]]; then
        log_warning "No files matching patterns found in archive"
        return 1
    fi

    # Return success if at least one file was found
    return 0
}

# Parse plugin information from archive filename
# Usage: parse_plugin_from_archive <filename>
# Example: parse_plugin_from_archive "my-plugin-1.2.3.tar.gz"
# Returns: plugin_name|version
parse_plugin_from_archive() {
    local filename="$1"
    local basename="${filename%.tar.gz}"

    # Try to match pattern: plugin-name-version
    # Version pattern: X.Y.Z with optional pre-release
    if [[ $basename =~ ^(.+)-([0-9]+\.[0-9]+\.[0-9]+.*)$ ]]; then
        local plugin_name="${BASH_REMATCH[1]}"
        local version="${BASH_REMATCH[2]}"
        echo "${plugin_name}|${version}"
        return 0
    fi

    log_warning "Could not parse plugin name and version from: $filename"
    return 1
}

# Get release assets matching plugin archive pattern
# Usage: get_plugin_assets <releases_json>
# Returns: JSON array of {name, download_url, tag_name}
get_plugin_assets() {
    local releases_json="$1"

    # Filter assets that match plugin archive pattern (*.tar.gz, not *.sha256)
    echo "$releases_json" | jq -c '
        [
            .[] |
            {
                tag_name: .tag_name,
                created_at: .created_at,
                assets: [
                    .assets[] |
                    select(.name | endswith(".tar.gz") and (endswith(".sha256.tar.gz") | not)) |
                    {
                        name: .name,
                        download_url: .browser_download_url,
                        size: .size
                    }
                ]
            } |
            select(.assets | length > 0)
        ]
    '
}

# Check if OCI tag exists in registry
# Usage: check_oci_tag_exists <oci_ref> <tag>
# Returns: 0 if exists, 1 if not exists
check_oci_tag_exists() {
    local oci_ref="$1"
    local tag="$2"

    if ! command -v oras &> /dev/null; then
        log_warning "ORAS not available, cannot check OCI tag existence"
        return 1
    fi

    # Try to fetch manifest (suppress output)
    if oras manifest fetch "${oci_ref}:${tag}" &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if GitHub Release tag exists
# Usage: check_github_release_exists <owner/repo> <tag> <github_token>
# Returns: 0 if exists, 1 if not exists
check_github_release_exists() {
    local repo="$1"
    local tag="$2"
    local token="${3:-$GITHUB_TOKEN}"

    if [[ -z "$token" ]]; then
        log_warning "GitHub token not available, cannot check release existence"
        return 1
    fi

    local url="https://api.github.com/repos/${repo}/releases/tags/${tag}"
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" \
                   -H "Authorization: token ${token}" \
                   -H "Accept: application/vnd.github.v3+json" \
                   "$url")

    if [[ "$response" == "200" ]]; then
        return 0
    else
        return 1
    fi
}

# Check if asset exists in a GitHub Release
# Usage: check_github_release_asset_exists <owner/repo> <tag> <asset_name> <github_token>
# Returns: 0 if exists, 1 if not exists
check_github_release_asset_exists() {
    local repo="$1"
    local tag="$2"
    local asset_name="$3"
    local token="${4:-$GITHUB_TOKEN}"

    if [[ -z "$token" ]]; then
        log_warning "GitHub token not available, cannot check asset existence"
        return 1
    fi

    local url="https://api.github.com/repos/${repo}/releases/tags/${tag}"
    local response
    response=$(curl -s \
                   -H "Authorization: token ${token}" \
                   -H "Accept: application/vnd.github.v3+json" \
                   "$url")

    if [[ $? -ne 0 ]]; then
        return 1
    fi

    # Check if asset exists in the response
    local asset_exists
    asset_exists=$(echo "$response" | jq -r --arg name "$asset_name" '.assets[]? | select(.name == $name) | .name' 2>/dev/null)

    if [[ -n "$asset_exists" ]]; then
        return 0
    else
        return 1
    fi
}

# Export all functions for use in other scripts
export -f log_info log_success log_error log_warning log_header log_section
export -f get_manifest_field validate_semver validate_command_name
export -f sanitize_name escape_html template_replace
export -f get_file_size get_file_size_human
export -f generate_checksum verify_checksum
export -f github_output github_output_json_array
export -f check_command check_required_commands
export -f ensure_directory for_each_plugin
export -f init_summary increment_counter get_counter print_summary
export -f die validate_required_fields
export -f fetch_github_releases download_release_asset extract_archive_files
export -f parse_plugin_from_archive get_plugin_assets
export -f check_oci_tag_exists check_github_release_exists check_github_release_asset_exists
