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

    if [[ -n "$GITHUB_OUTPUT" ]]; then
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

# Export all functions for use in other scripts
export -f log_info log_success log_error log_warning log_header log_section
export -f get_manifest_field validate_semver validate_command_name
export -f sanitize_name escape_html
export -f get_file_size get_file_size_human
export -f generate_checksum verify_checksum
export -f github_output github_output_json_array
export -f check_command check_required_commands
export -f ensure_directory for_each_plugin
export -f init_summary increment_counter get_counter print_summary
export -f die validate_required_fields
