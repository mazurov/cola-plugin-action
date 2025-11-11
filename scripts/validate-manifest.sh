#!/usr/bin/env bash

set -euo pipefail

# validate-manifest.sh
# Validates plugin manifests against Command Launcher specification

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

PLUGINS_DIR="${PLUGINS_DIR:-plugins}"

log_info "Validating plugins in: $PLUGINS_DIR"

# Check if plugins directory exists
if [[ ! -d "$PLUGINS_DIR" ]]; then
    die "Directory $PLUGINS_DIR does not exist"
fi

# Initialize counters
init_summary
validated_dirs=()

# Required fields for JSON manifest (Command Launcher spec)
REQUIRED_FIELDS=("pkgName" "version")
# Commands must exist and have at least one command with name and type
METADATA_FIELDS=("author" "license" "homepage" "repository" "tags")

# Process each plugin
for plugin_dir in "$PLUGINS_DIR"/*/ ; do
    [[ ! -d "$plugin_dir" ]] && continue

    plugin_name=$(basename "$plugin_dir")
    manifest_file="${plugin_dir}manifest.mf"

    echo ""
    echo "Checking plugin: $plugin_name"

    increment_counter "Total plugins"
    has_errors=false

    # Check if manifest exists
    if [[ ! -f "$manifest_file" ]]; then
        log_error "No manifest.mf found"
        increment_counter "Invalid plugins"
        continue
    fi

    # Validate JSON/YAML format using yq (supports both)
    if ! command -v yq &> /dev/null; then
        log_error "yq is required but not installed"
        has_errors=true
        increment_counter "Invalid plugins"
        log_error "Plugin validation failed"
        continue
    fi

    if ! yq eval '.' "$manifest_file" >/dev/null 2>&1; then
        log_error "Invalid JSON/YAML format"
        has_errors=true
        increment_counter "Invalid plugins"
        log_error "Plugin validation failed"
        continue
    fi

    # Validate required fields
    for field in "${REQUIRED_FIELDS[@]}"; do
        value=$(get_manifest_field "$manifest_file" "$field")

        if [[ -z "$value" ]]; then
            log_error "Missing required field: $field"
            has_errors=true
        else
            log_success "$field: $value"

            # Additional validation for specific fields
            case "$field" in
                version)
                    if ! validate_semver "$value"; then
                        log_error "Invalid version format: $value"
                        echo "     Expected semantic version (e.g., 1.0.0, 2.1.0-beta)"
                        has_errors=true
                    fi
                    ;;
            esac
        fi
    done

    # Validate commands array
    cmds_count=$(get_manifest_field "$manifest_file" "cmds_count")
    if [[ -z "$cmds_count" || "$cmds_count" -eq 0 ]]; then
        log_error "Missing or empty 'cmds' array - at least one command required"
        has_errors=true
    else
        log_success "Commands: $cmds_count command(s) defined"

        # Validate first command (primary command)
        command_name=$(get_manifest_field "$manifest_file" "command_name")
        command_type=$(get_manifest_field "$manifest_file" "command_type")

        if [[ -z "$command_name" ]]; then
            log_error "First command missing 'name' field"
            has_errors=true
        else
            log_success "Command name: $command_name"
            if ! validate_command_name "$command_name"; then
                log_error "Invalid command name: $command_name"
                echo "     Must be lowercase alphanumeric with hyphens"
                has_errors=true
            fi
        fi

        if [[ -z "$command_type" ]]; then
            log_error "First command missing 'type' field"
            has_errors=true
        else
            log_success "Command type: $command_type"
            if [[ ! "$command_type" =~ ^(executable|group|system)$ ]]; then
                log_error "Invalid command type: $command_type"
                echo "     Must be one of: executable, group, system"
                has_errors=true
            fi
        fi

        # If type is executable, check for executable field
        if [[ "$command_type" == "executable" ]]; then
            executable=$(get_manifest_field "$manifest_file" "executable")
            if [[ -z "$executable" ]]; then
                log_error "Command type 'executable' requires 'executable' field"
                has_errors=true
            else
                log_success "Executable: $executable"
            fi
        fi
    fi

    # Check for README.md
    if [[ ! -f "${plugin_dir}README.md" ]]; then
        log_warning "No README.md found (recommended)"
    else
        log_success "README.md present"
    fi

    # Display metadata fields if present
    description=$(get_manifest_field "$manifest_file" "description")
    if [[ -n "$description" ]]; then
        log_success "Description: $description"
    fi

    for field in "${METADATA_FIELDS[@]}"; do
        value=$(get_manifest_field "$manifest_file" "$field")
        if [[ -n "$value" ]]; then
            # Capitalize first letter
            field_display="$(tr '[:lower:]' '[:upper:]' <<< ${field:0:1})${field:1}"
            log_success "$field_display: $value"
        fi
    done

    # Update counters
    if [[ $has_errors == false ]]; then
        increment_counter "Valid plugins"
        validated_dirs+=("$plugin_dir")
        log_success "Plugin validated successfully"
    else
        increment_counter "Invalid plugins"
        log_error "Plugin validation failed"
    fi
done

# Print summary
log_header "Validation Summary"
echo "Total plugins: $(get_counter "Total plugins")"
log_success "Valid: $(get_counter "Valid plugins")"
if [[ $(get_counter "Invalid plugins") -gt 0 ]]; then
    log_error "Invalid: $(get_counter "Invalid plugins")"
fi

# Export validated plugins to GitHub output
github_output_json_array "plugins" "${validated_dirs[@]}"
if [[ -n "$GITHUB_OUTPUT" ]]; then
    log_info "Exported validated plugins to GITHUB_OUTPUT"
fi

# Exit with error if any plugins failed validation
if [[ $(get_counter "Invalid plugins") -gt 0 ]]; then
    exit 1
fi

echo ""
log_success "All plugins validated successfully"
exit 0
