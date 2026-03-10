# Migration to Tauri v2

This document outlines the changes made to upgrade MimicReader from Tauri v1 to Tauri v2 for Arch Linux compatibility (webkit2gtk-4.1 support).

## Summary of Changes

### 1. Package Dependencies

#### package.json
```json
// BEFORE (Tauri v1)
"@tauri-apps/cli": "^1.5.0"

// AFTER (Tauri v2)
"@tauri-apps/api": "^2.0.0",
"@tauri-apps/plugin-fs": "^2.0.0",
"@tauri-apps/plugin-path": "^2.0.0",
"@tauri-apps/cli": "^2.0.0"
```

#### Cargo.toml
```toml
# BEFORE (Tauri v1)
[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.6", features = ["fs-all", "path-all", "shell-open"] }

# AFTER (Tauri v2)
[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = ["fs-all", "path-all", "shell-open"] }
tauri-plugin-fs = "2.0"
tauri-plugin-path = "2.0"
```

### 2. Configuration Changes

#### tauri.conf.json
```json
// BEFORE (v1 structure)
{
  "build": {
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "tauri": {
    "allowlist": { ... },
    "windows": [ ... ]
  }
}

// AFTER (v2 structure)
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "com.mimicreader.app",
  "build": {
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [ ... ],
    "security": { "csp": null }
  },
  "bundle": { ... },
  "plugins": {
    "fs": { "all": true, "scope": ["**"] },
    "path": { "all": true }
  }
}
```

**Key Changes:**
- `devPath` → `devUrl`
- `distDir` → `frontendDist`
- `allowlist` → moved to `capabilities/` JSON files
- `tauri` object split into `app`, `bundle`, `plugins`
- Added `$schema` and `identifier` at root level

### 3. New Capabilities System

Tauri v2 introduces a new permission/capability system. Created `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2/capability",
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "fs:allow-read-file",
    "fs:allow-read-dir",
    "path:default",
    "shell:allow-open"
  ]
}
```

### 4. Rust Backend Changes

#### main.rs

**State Lifetime Annotation:**
```rust
// BEFORE
#[tauri::command]
fn get_library(state: State<AppState>) -> Result<Vec<Book>, String>

// AFTER
#[tauri::command]
fn get_library(state: State<'_, AppState>) -> Result<Vec<Book>, String>
```

**Plugin Registration:**
```rust
// BEFORE
tauri::Builder::default()
    .run(tauri::generate_context!())

// AFTER
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_path::init())
    .run(tauri::generate_context!())
```

### 5. Frontend API Changes

#### Import Path Updates
```typescript
// BEFORE (Tauri v1)
import { invoke } from '@tauri-apps/api'
import { path } from '@tauri-apps/api'

// AFTER (Tauri v2)
import { invoke } from '@tauri-apps/api/core'
// Path commands now called directly via invoke
```

#### Command Name Changes
```typescript
// BEFORE
const homeDir = await invoke<string>('path:home_dir')

// AFTER
const homeDir = await invoke<string>('get_home_dir')
// Custom command in Rust backend
```

## System Requirements

### Arch Linux
```bash
# Install Tauri v2 dependencies (webkit2gtk-4.1)
sudo pacman -S --needed \
  webkit2gtk-5.0 \
  gtk3 \
  javascriptcoregtk-5.0 \
  libsoup3 \
  libappindicator-gtk3 \
  librsvg
```

**Note:** Tauri v2 uses webkit2gtk-5.0 (or 4.1 in some distros), which is available on Arch Linux.

### Ubuntu/Debian
```bash
# May need to build WebKit from source or use PPA
# Tauri v2 requires newer WebKit version
```

### Fedora
```bash
sudo dnf install -y \
  webkit2gtk5.0-devel \
  gtk3-devel \
  javascriptcoregtk5.0-devel \
  libsoup3-devel
```

## Breaking Changes

### 1. Removed APIs
- `appWindow` → Use `getCurrentWindow()` from `@tauri-apps/api/webviewWindow`
- `listen` for events → Moved to `@tauri-apps/api/event`

### 2. Permission System
- Old `allowlist` in `tauri.conf.json` no longer works
- Must define capabilities in separate JSON files
- More granular permission control

### 3. Path Plugin
- No longer built-in to core
- Must install `tauri-plugin-path`
- Commands accessed differently

### 4. FS Plugin
- No longer built-in to core
- Must install `tauri-plugin-fs`
- Scope configuration changed

## Testing Checklist

- [ ] Rust backend compiles without errors
- [ ] Frontend builds successfully
- [ ] `npm run tauri dev` launches app
- [ ] Library scanning works
- [ ] PDF covers load correctly
- [ ] File system access works
- [ ] Path resolution works
- [ ] No console errors about missing permissions

## Build Commands

```bash
# Development
npm run tauri dev

# Build for production
npm run tauri build

# Build with verbose output
cargo build --verbose  # In src-tauri/
```

## Troubleshooting

### "webkit2gtk not found"
Ensure you have the correct WebKit version installed for your distro. Arch Linux has 5.0, older distros may have 4.1.

### "Permission denied" errors
Check `capabilities/default.json` includes the required permissions. Add missing permissions:
```json
"permissions": [
  "fs:allow-read-file",
  "fs:allow-read-dir"
]
```

### "Module not found: @tauri-apps/api/core"
Ensure you have `@tauri-apps/api@^2.0.0` in `package.json` and run `npm install`.

### Rust compilation errors
Make sure all dependencies in `Cargo.toml` use version `2.0` for Tauri packages.

## Resources

- [Tauri v2 Migration Guide](https://v2.tauri.app/start/migrate/from-tauri-1/)
- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Tauri v2 API Reference](https://v2.tauri.app/reference/javascript/)
