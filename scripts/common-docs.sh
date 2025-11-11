#!/usr/bin/env bash

# common-docs.sh
# Shared functions for documentation generation

# This file must be sourced after common.sh
# Usage: source "${SCRIPT_DIR}/common-docs.sh"

# ============================================================================
# Documentation Generation Functions
# ============================================================================

# Convert markdown to HTML
# Usage: markdown_to_html <markdown_file>
markdown_to_html() {
    local markdown_file="$1"

    if [[ ! -f "$markdown_file" ]]; then
        echo "<p><em>No README available</em></p>"
        return
    fi

    if command -v pandoc &> /dev/null; then
        pandoc "$markdown_file" -f markdown -t html
    else
        # Basic markdown to HTML conversion (fallback)
        echo "<div><pre>$(cat "$markdown_file")</pre></div>"
    fi
}

# Build metadata items HTML for a plugin
# Usage: build_metadata_html <manifest_file>
build_metadata_html() {
    local manifest_file="$1"
    local metadata_items=""

    # Extract fields
    local description=$(get_manifest_field "$manifest_file" "description")
    local author=$(get_manifest_field "$manifest_file" "author")
    local license=$(get_manifest_field "$manifest_file" "license")
    local homepage=$(get_manifest_field "$manifest_file" "homepage")
    local repository=$(get_manifest_field "$manifest_file" "repository")
    local tags=$(get_manifest_field "$manifest_file" "tags")

    # Build HTML
    if [[ -n "$description" ]]; then
        metadata_items+="<div class=\"metadata-item\"><span class=\"metadata-label\">Description</span><span class=\"metadata-value\">$(escape_html "$description")</span></div>"
    fi

    if [[ -n "$author" ]]; then
        metadata_items+="<div class=\"metadata-item\"><span class=\"metadata-label\">Author</span><span class=\"metadata-value\">$(escape_html "$author")</span></div>"
    fi

    if [[ -n "$license" ]]; then
        metadata_items+="<div class=\"metadata-item\"><span class=\"metadata-label\">License</span><span class=\"metadata-value\">$(escape_html "$license")</span></div>"
    fi

    if [[ -n "$homepage" ]]; then
        metadata_items+="<div class=\"metadata-item\"><span class=\"metadata-label\">Homepage</span><span class=\"metadata-value\"><a href=\"$(escape_html "$homepage")\" target=\"_blank\">$(escape_html "$homepage")</a></span></div>"
    fi

    if [[ -n "$repository" ]]; then
        metadata_items+="<div class=\"metadata-item\"><span class=\"metadata-label\">Repository</span><span class=\"metadata-value\"><a href=\"$(escape_html "$repository")\" target=\"_blank\">$(escape_html "$repository")</a></span></div>"
    fi

    if [[ -n "$tags" ]]; then
        local tags_html="<div class=\"tags\">"
        IFS=',' read -ra tag_array <<< "$tags"
        for tag in "${tag_array[@]}"; do
            tag=$(echo "$tag" | xargs) # trim whitespace
            tags_html+="<span class=\"tag\">$(escape_html "$tag")</span>"
        done
        tags_html+="</div>"
        metadata_items+="<div class=\"metadata-item\"><span class=\"metadata-label\">Tags</span><span class=\"metadata-value\">$tags_html</span></div>"
    fi

    echo "$metadata_items"
}

# Build commands section HTML for a plugin
# Usage: build_commands_html <manifest_file>
build_commands_html() {
    local manifest_file="$1"
    local commands_html=""

    # Check if yq is available
    if ! command -v yq &> /dev/null; then
        return
    fi

    # Get number of commands
    local cmd_count=$(yq eval '.cmds | length' "$manifest_file" 2>/dev/null || echo "0")

    if [[ "$cmd_count" == "null" ]] || [[ "$cmd_count" -eq 0 ]]; then
        return
    fi

    commands_html="<div class=\"commands-section\"><h2>Commands</h2><div class=\"command-list\">"

    # Iterate through commands
    for i in $(seq 0 $((cmd_count - 1))); do
        local name=$(yq eval ".cmds[$i].name" "$manifest_file" 2>/dev/null)
        local type=$(yq eval ".cmds[$i].type" "$manifest_file" 2>/dev/null)
        local short=$(yq eval ".cmds[$i].short" "$manifest_file" 2>/dev/null)
        local long=$(yq eval ".cmds[$i].long" "$manifest_file" 2>/dev/null)
        local executable=$(yq eval ".cmds[$i].executable" "$manifest_file" 2>/dev/null)
        local alias_cmd=$(yq eval ".cmds[$i].alias" "$manifest_file" 2>/dev/null)
        local group=$(yq eval ".cmds[$i].group" "$manifest_file" 2>/dev/null)

        # Skip if name is null/empty
        if [[ "$name" == "null" ]] || [[ -z "$name" ]]; then
            continue
        fi

        # Start command card
        commands_html+="<div class=\"command-card\">"

        # Command header (name + type)
        commands_html+="<div class=\"command-header\">"
        commands_html+="<span class=\"command-code\">$(escape_html "$name")</span>"

        if [[ "$type" != "null" ]] && [[ -n "$type" ]]; then
            commands_html+="<span class=\"command-type\">$(escape_html "$type")</span>"
        fi
        commands_html+="</div>"

        # Short description
        if [[ "$short" != "null" ]] && [[ -n "$short" ]]; then
            commands_html+="<p class=\"command-description\">$(escape_html "$short")</p>"
        fi

        # Long description
        if [[ "$long" != "null" ]] && [[ -n "$long" ]]; then
            commands_html+="<p class=\"command-description\">$(escape_html "$long")</p>"
        fi

        # Command details
        local has_details=false
        local details_html="<div class=\"command-details\">"

        if [[ "$executable" != "null" ]] && [[ -n "$executable" ]]; then
            details_html+="<span class=\"command-detail-label\">Executable:</span>"
            details_html+="<span class=\"command-detail-value\">$(escape_html "$executable")</span>"
            has_details=true
        fi

        if [[ "$alias_cmd" != "null" ]] && [[ -n "$alias_cmd" ]]; then
            details_html+="<span class=\"command-detail-label\">Alias:</span>"
            details_html+="<span class=\"command-detail-value\">$(escape_html "$alias_cmd")</span>"
            has_details=true
        fi

        if [[ "$group" != "null" ]] && [[ -n "$group" ]]; then
            details_html+="<span class=\"command-detail-label\">Group:</span>"
            details_html+="<span class=\"command-detail-value\">$(escape_html "$group")</span>"
            has_details=true
        fi

        # Check for flags
        local flags_count=$(yq eval ".cmds[$i].flags | length" "$manifest_file" 2>/dev/null || echo "0")
        if [[ "$flags_count" != "null" ]] && [[ "$flags_count" != "0" ]] && [[ "$flags_count" -gt 0 ]]; then
            details_html+="<span class=\"command-detail-label\">Flags:</span>"
            details_html+="<span class=\"command-detail-value\">"
            for j in $(seq 0 $((flags_count - 1))); do
                local flag_name=$(yq eval ".cmds[$i].flags[$j].name" "$manifest_file" 2>/dev/null)
                local flag_short=$(yq eval ".cmds[$i].flags[$j].short" "$manifest_file" 2>/dev/null)
                local flag_desc=$(yq eval ".cmds[$i].flags[$j].desc" "$manifest_file" 2>/dev/null)

                if [[ "$flag_name" != "null" ]]; then
                    if [[ "$j" -gt 0 ]]; then
                        details_html+="<br>"
                    fi
                    details_html+="--$(escape_html "$flag_name")"
                    if [[ "$flag_short" != "null" ]] && [[ -n "$flag_short" ]]; then
                        details_html+=", -$(escape_html "$flag_short")"
                    fi
                    if [[ "$flag_desc" != "null" ]] && [[ -n "$flag_desc" ]]; then
                        details_html+=": $(escape_html "$flag_desc")"
                    fi
                fi
            done
            details_html+="</span>"
            has_details=true
        fi

        details_html+="</div>"

        if [[ "$has_details" == "true" ]]; then
            commands_html+="$details_html"
        fi

        commands_html+="</div>"
    done

    commands_html+="</div></div>"
    echo "$commands_html"
}

# Generate a plugin documentation page
# Usage: generate_plugin_page <manifest_file> <plugin_dir> <template_path> <output_file> [template_dir]
# Returns: plugin_name|plugin_version|command_name|description (for index generation)
generate_plugin_page() {
    local manifest_file="$1"
    local plugin_dir="$2"
    local template_path="$3"
    local output_file="$4"
    local template_dir="${5:-$(dirname "$template_path")}"  # Optional: for version selector

    # Extract plugin metadata
    local plugin_name=$(get_manifest_field "$manifest_file" "pkgName")
    local plugin_version=$(get_manifest_field "$manifest_file" "version")
    local command_name=$(get_manifest_field "$manifest_file" "command_name")

    if [[ -z "$plugin_name" || -z "$plugin_version" || -z "$command_name" ]]; then
        return 1
    fi

    # Build metadata HTML
    local metadata_items=$(build_metadata_html "$manifest_file")

    # Build commands section HTML
    local commands_html=$(build_commands_html "$manifest_file")

    # Build version selector HTML (if template exists)
    local version_selector_html=$(build_version_selector "$plugin_name" "$plugin_version" "$template_dir")

    # Convert README to HTML
    local readme_html=$(markdown_to_html "${plugin_dir}README.md")

    # Load template
    if [[ ! -f "$template_path" ]]; then
        log_error "Template not found: $template_path"
        return 1
    fi

    local template_content=$(cat "$template_path")

    # Replace placeholders
    local page_content="$template_content"
    page_content=$(template_replace "$page_content" "{{PLUGIN_NAME}}" "$(escape_html "$plugin_name")")
    page_content=$(template_replace "$page_content" "{{PLUGIN_VERSION}}" "$(escape_html "$plugin_version")")
    page_content=$(template_replace "$page_content" "{{COMMAND_NAME}}" "$(escape_html "$command_name")")
    page_content=$(template_replace "$page_content" "{{METADATA_ITEMS}}" "$metadata_items")
    page_content=$(template_replace "$page_content" "{{COMMANDS_SECTION}}" "$commands_html")
    page_content=$(template_replace "$page_content" "{{VERSION_SELECTOR}}" "$version_selector_html")
    page_content=$(template_replace "$page_content" "{{README_CONTENT}}" "$readme_html")

    # Write to file
    echo "$page_content" > "$output_file"

    # Return plugin info for index (pipe-separated)
    echo "${plugin_name}|${plugin_version}|${command_name}|$(get_manifest_field "$manifest_file" "description")"
}

# Generate plugin card HTML for index page
# Usage: generate_plugin_card <plugin_page> <plugin_name> <plugin_version> <command_name> <description>
generate_plugin_card() {
    local plugin_page="$1"
    local plugin_name="$2"
    local plugin_version="$3"
    local command_name="$4"
    local description="$5"

    local card="<div class=\"plugin-card\"><h3><a href=\"$plugin_page\">$(escape_html "$plugin_name")</a></h3>"
    card+="<p class=\"plugin-version\">v$(escape_html "$plugin_version")</p>"
    card+="<p class=\"plugin-command\">$(escape_html "$command_name")</p>"

    if [[ -n "$description" ]]; then
        card+="<p class=\"plugin-description\">$(escape_html "$description")</p>"
    fi

    card+="</div>"
    echo "$card"
}

# Generate the index page HTML template (part 1 - header)
# Usage: generate_index_header <title> <subtitle> [preview_mode]
generate_index_header() {
    local title="$1"
    local subtitle="$2"
    local preview_mode="${3:-false}"

    cat <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
EOF

    echo "    <title>$title</title>"

    cat <<'EOF'
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem 0;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        .subtitle { font-size: 1.2rem; opacity: 0.9; }
        .preview-badge {
            background: rgba(255, 165, 0, 0.2);
            color: #ffa500;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            display: inline-block;
            margin-top: 1rem;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .plugin-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-top: 2rem;
        }
        .plugin-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .plugin-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .plugin-card h3 {
            margin-bottom: 0.5rem;
            color: #667eea;
        }
        .plugin-card a {
            color: inherit;
            text-decoration: none;
        }
        .plugin-card a:hover { text-decoration: underline; }
        .plugin-version {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        .plugin-command {
            background: #f5f5f5;
            padding: 0.3rem 0.6rem;
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.9rem;
            display: inline-block;
            margin-bottom: 0.8rem;
        }
        .plugin-description {
            color: #666;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        footer {
            text-align: center;
            padding: 2rem;
            color: #666;
            margin-top: 3rem;
        }
        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }
    </style>
</head>
<body>
    <header>
EOF

    echo "        <h1>$title</h1>"
    echo "        <p class=\"subtitle\">$subtitle</p>"

    if [[ "$preview_mode" == "true" ]]; then
        echo '        <span class="preview-badge">🔍 PREVIEW MODE - Not published</span>'
    fi

    cat <<'EOF'
    </header>
    <div class="container">
        <div class="plugin-grid">
EOF
}

# Generate the index page HTML template (part 2 - footer)
# Usage: generate_index_footer [message]
generate_index_footer() {
    local message="${1:-Generated by <a href=\"https://github.com/criteo/cola-plugin-action\" style=\"color: #667eea;\">Cola Plugin Action</a>}"

    cat <<EOF
        </div>
    </div>
    <footer>
        $message
    </footer>
</body>
</html>
EOF
}

# Process all plugins in a directory and generate documentation
# Usage: process_plugins_for_docs <plugins_dir> <template_path> <plugin_cards_array_name>
# Example: process_plugins_for_docs "$PLUGINS_DIR" "$TEMPLATE_PATH" plugin_cards
# Returns: Modifies the named array with plugin cards
process_plugins_for_docs() {
    local plugins_dir="$1"
    local template_path="$2"
    local cards_array_name="$3"

    # Process each plugin
    for plugin_dir in "$plugins_dir"/*/ ; do
        [[ ! -d "$plugin_dir" ]] && continue

        local manifest_file="${plugin_dir}manifest.mf"

        if [[ ! -f "$manifest_file" ]]; then
            log_warning "Skipping $(basename "$plugin_dir") - no manifest"
            continue
        fi

        log_info "Processing: $(basename "$plugin_dir")"

        # Get command name first to check if valid
        local command_name=$(get_manifest_field "$manifest_file" "command_name")
        if [[ -z "$command_name" ]]; then
            log_warning "Skipping - no command name found"
            continue
        fi

        # Sanitize name for filename
        local safe_name=$(sanitize_name "$command_name")
        if [[ -z "$safe_name" ]]; then
            log_warning "Skipping - invalid command name"
            continue
        fi

        local plugin_page="plugins/${safe_name}.html"

        # Generate plugin page using common function
        local plugin_info=$(generate_plugin_page "$manifest_file" "$plugin_dir" "$template_path" "$plugin_page")

        if [[ -z "$plugin_info" ]]; then
            log_warning "Skipping - incomplete manifest or generation failed"
            continue
        fi

        log_success "Generated: $plugin_page"

        # Parse plugin info (format: plugin_name|plugin_version|command_name|description)
        local plugin_name plugin_version plugin_cmd description
        IFS='|' read -r plugin_name plugin_version plugin_cmd description <<< "$plugin_info"

        # Generate plugin card for index
        local plugin_card=$(generate_plugin_card "$plugin_page" "$plugin_name" "$plugin_version" "$plugin_cmd" "$description")

        # Add to the array using eval (to handle dynamic array name)
        eval "$cards_array_name+=(\"$plugin_card\")"
    done
}

# Generate complete index.html with plugin cards
# Usage: generate_index_page <output_file> <title> <subtitle> <cards_array_name> [preview_mode] [footer_message]
# Example: generate_index_page "index.html" "My Plugins" "Browse plugins" plugin_cards "false" "Custom footer"
generate_index_page() {
    local output_file="$1"
    local title="$2"
    local subtitle="$3"
    local cards_array_name="$4"
    local preview_mode="${5:-false}"
    local footer_message="${6:-}"

    # Generate header
    generate_index_header "$title" "$subtitle" "$preview_mode" > "$output_file"

    # Add plugin cards using eval to access the array
    local card_count
    eval "card_count=\${#${cards_array_name}[@]}"

    if [[ $card_count -gt 0 ]]; then
        local i
        for ((i=0; i<card_count; i++)); do
            local card
            eval "card=\${${cards_array_name}[$i]}"
            echo "$card" >> "$output_file"
        done
    else
        echo '<div class="empty-state"><p>No plugins found.</p></div>' >> "$output_file"
    fi

    # Generate footer
    if [[ -n "$footer_message" ]]; then
        generate_index_footer "$footer_message" >> "$output_file"
    else
        generate_index_footer >> "$output_file"
    fi

    log_success "Generated: $output_file"
}

# ============================================================================
# Versioned Documentation Functions
# ============================================================================

# Check if a specific plugin version already exists in gh-pages
# Usage: version_exists <gh_pages_dir> <plugin_name> <version>
# Returns: 0 if exists, 1 if not
version_exists() {
    local gh_pages_dir="$1"
    local plugin_name="$2"
    local version="$3"

    if [[ -d "${gh_pages_dir}/plugins/${plugin_name}/v${version}" ]]; then
        return 0
    else
        return 1
    fi
}

# Get list of existing versions for a plugin from gh-pages directory
# Usage: get_existing_versions <gh_pages_dir> <plugin_name>
# Returns: Space-separated list of versions (without 'v' prefix)
get_existing_versions() {
    local gh_pages_dir="$1"
    local plugin_name="$2"
    local versions=""

    if [[ -d "${gh_pages_dir}/plugins/${plugin_name}" ]]; then
        for version_dir in "${gh_pages_dir}/plugins/${plugin_name}"/v*/ ; do
            if [[ -d "$version_dir" ]]; then
                local version=$(basename "$version_dir")
                version="${version#v}"  # Remove 'v' prefix
                versions="${versions}${version} "
            fi
        done
    fi

    echo "$versions" | xargs  # Trim whitespace
}

# Compare semantic versions
# Usage: version_compare <version1> <version2>
# Returns: 0 if v1 == v2, 1 if v1 > v2, 2 if v1 < v2
version_compare() {
    local v1="$1"
    local v2="$2"

    if [[ "$v1" == "$v2" ]]; then
        return 0
    fi

    local IFS=.
    local i ver1=($v1) ver2=($v2)

    # Fill empty positions with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done

    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2
        fi
    done
    return 0
}

# Sort versions in descending order (newest first)
# Usage: sort_versions <version1> <version2> ...
# Returns: Sorted versions, one per line
sort_versions() {
    printf '%s\n' "$@" | sort -V -r
}

# Update or create versions.json metadata file
# Usage: update_versions_json <gh_pages_dir> <plugin_name> <versions_array>
update_versions_json() {
    local gh_pages_dir="$1"
    local plugin_name="$2"
    shift 2
    local versions=("$@")

    local json_file="${gh_pages_dir}/versions.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Find latest version
    # Assume versions are already sorted (newest first)
    local latest_version=""
    if [[ ${#versions[@]} -gt 0 ]]; then
        latest_version="${versions[0]}"
    fi

    # Build versions array JSON
    local versions_json="["
    for i in "${!versions[@]}"; do
        if [[ $i -gt 0 ]]; then
            versions_json+=","
        fi
        versions_json+="\"${versions[i]}\""
    done
    versions_json+="]"

    # If versions.json doesn't exist, create it
    if [[ ! -f "$json_file" ]]; then
        echo '{"plugins":{},"generated_at":"'$timestamp'"}' > "$json_file"
    fi

    # Update using jq (prefer over yq for better stability)
    local temp_file=$(mktemp)
    if command -v jq &> /dev/null; then
        jq --arg pkg "$plugin_name" \
           --arg latest "$latest_version" \
           --argjson versions "$versions_json" \
           --arg updated "$timestamp" \
           '.plugins[$pkg] = {pkgName: $pkg, latest: $latest, versions: $versions, last_updated: $updated} | .generated_at = $updated' \
           "$json_file" > "$temp_file" && mv "$temp_file" "$json_file"
    elif command -v yq &> /dev/null; then
        # Fallback to yq with temp file
        yq eval ".plugins.\"${plugin_name}\" = {\"pkgName\": \"${plugin_name}\", \"latest\": \"${latest_version}\", \"versions\": ${versions_json}, \"last_updated\": \"${timestamp}\"}" "$json_file" > "$temp_file"
        mv "$temp_file" "$json_file"
        temp_file=$(mktemp)
        yq eval ".generated_at = \"${timestamp}\"" "$json_file" > "$temp_file"
        mv "$temp_file" "$json_file"
    fi
}

# Delete old versions keeping only N newest
# Usage: cleanup_old_versions <gh_pages_dir> <plugin_name> <keep_count>
cleanup_old_versions() {
    local gh_pages_dir="$1"
    local plugin_name="$2"
    local keep_count="$3"

    if [[ "$keep_count" -eq 0 ]]; then
        return  # Keep all versions
    fi

    local versions=($(get_existing_versions "$gh_pages_dir" "$plugin_name"))
    if [[ ${#versions[@]} -le $keep_count ]]; then
        return  # Not enough versions to clean
    fi

    # Sort versions
    local sorted_versions=($(sort_versions "${versions[@]}"))

    # Delete old versions
    local delete_count=$((${#sorted_versions[@]} - keep_count))
    for ((i=keep_count; i<${#sorted_versions[@]}; i++)); do
        local old_version="${sorted_versions[$i]}"
        local version_dir="${gh_pages_dir}/plugins/${plugin_name}/v${old_version}"
        if [[ -d "$version_dir" ]]; then
            log_info "Cleaning up old version: ${plugin_name} v${old_version}"
            rm -rf "$version_dir"
        fi
    done

    # Update versions.json with remaining versions
    update_versions_json "$gh_pages_dir" "$plugin_name" "${sorted_versions[@]:0:$keep_count}"
}

# Build version selector HTML component
# Usage: build_version_selector <plugin_name> <version> <template_dir>
# Returns: HTML for version selector (or empty if versioning disabled)
build_version_selector() {
    local plugin_name="$1"
    local version="$2"
    local template_dir="$3"

    local selector_template="${template_dir}/version-selector.html"

    if [[ ! -f "$selector_template" ]]; then
        echo ""  # No version selector if template doesn't exist
        return
    fi

    # Read and process template
    local selector_html=$(cat "$selector_template")
    selector_html=$(template_replace "$selector_html" "{{PLUGIN_NAME}}" "$(escape_html "$plugin_name")")
    selector_html=$(template_replace "$selector_html" "{{PLUGIN_VERSION}}" "$(escape_html "$version")")

    echo "$selector_html"
}

# Generate version index page for a plugin
# Usage: generate_version_index_page <plugin_name> <versions_array> <latest_version> <output_file> <template_path>
generate_version_index_page() {
    local plugin_name="$1"
    shift
    local -a versions=()
    local latest_version=""
    local output_file=""
    local template_path=""

    # Parse remaining arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --latest)
                latest_version="$2"
                shift 2
                ;;
            --output)
                output_file="$2"
                shift 2
                ;;
            --template)
                template_path="$2"
                shift 2
                ;;
            *)
                versions+=("$1")
                shift
                ;;
        esac
    done

    if [[ -z "$output_file" || -z "$template_path" ]]; then
        log_error "Missing required parameters for version index page"
        return 1
    fi

    # Load template
    if [[ ! -f "$template_path" ]]; then
        log_error "Version index template not found: $template_path"
        return 1
    fi

    local template_content=$(cat "$template_path")

    # Build version items HTML
    local version_items=""

    if [[ ${#versions[@]} -eq 0 ]]; then
        version_items='<div class="empty-state"><p>No versions available.</p></div>'
    else
        for version in "${versions[@]}"; do
            local badges=""
            if [[ "$version" == "$latest_version" ]]; then
                badges+='<span class="version-badge badge-latest">Latest</span>'
            fi

            version_items+='<div class="version-item">'
            version_items+='<div class="version-info">'
            version_items+="<div class=\"version-number\">v${version}${badges}</div>"
            version_items+='</div>'
            version_items+="<a href=\"v${version}/\" class=\"version-link\">View Docs →</a>"
            version_items+='</div>'
        done
    fi

    # Replace placeholders
    local page_content="$template_content"
    page_content=$(template_replace "$page_content" "{{PLUGIN_NAME}}" "$(escape_html "$plugin_name")")
    page_content=$(template_replace "$page_content" "{{VERSION_ITEMS}}" "$version_items")

    # Write to file
    echo "$page_content" > "$output_file"

    log_success "Generated version index: $output_file"
}
