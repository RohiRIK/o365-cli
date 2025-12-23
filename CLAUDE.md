# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**o365-cli** is a high-performance Microsoft 365 administration platform using a hybrid Rust + TypeScript architecture. The project separates concerns between a Rust-based TUI frontend and TypeScript business logic workers, connected via IPC.

## Commands

### Build & Run

```bash
# Build the Rust CLI (run from project root or cli/ directory)
cargo build --release --manifest-path cli/Cargo.toml

# Run the interactive TUI dashboard (no arguments)
./cli/target/release/o365-cli

# Development mode with hot reload
cargo run --manifest-path cli/Cargo.toml
```

### Testing

```bash
# Run TypeScript tests with Bun
cd core && bun test
```

### CLI Commands (Headless Mode)

```bash
# Authenticate with Microsoft Entra ID
./cli/target/release/o365-cli login --tenant common

# Run specific tasks directly
./cli/target/release/o365-cli run iam:offboard --user user@domain.com --dry-run true
./cli/target/release/o365-cli run sec:shadow-it --dry-run false
./cli/target/release/o365-cli run iam:guest-cleanup --days 90 --dry-run true
```

## Architecture

### Hybrid Design Philosophy

This is a **multi-language, IPC-driven architecture** where each component plays to its strengths:

**Rust CLI (`cli/`)** - "The Brain"
- Orchestrates the entire application lifecycle
- Renders the interactive TUI using Ratatui
- Handles OAuth2 PKCE authentication flow
- Manages secure token storage via OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Spawns TypeScript workers and manages IPC communication
- **Never touches Microsoft Graph API directly** - delegates all M365 operations to workers

**TypeScript Workers (`core/`)** - "The Muscle"
- Executes all Microsoft Graph API business logic
- Runs via Bun runtime for high performance
- Receives OAuth tokens securely via stdin
- Communicates results via structured JSON over stdout
- Implements dry-run mode for safe previewing of destructive operations

### Inter-Process Communication (IPC)

**Token Flow (Rust → TypeScript):**
- Rust writes OAuth access token to worker's stdin (never exposed in process args)
- Workers read token once on startup via `GraphService.initialize()`

**Result Flow (TypeScript → Rust):**
Workers output structured JSON messages to stdout only. Available message types:
```typescript
{ type: "progress", message: string, percent: number }
{ type: "log", message: string, level: "info"|"warn"|"error" }
{ type: "success", data: { table?: {...}, message?: string } }
{ type: "error", message: string }
```

**Critical Rule:** TypeScript workers must NEVER use `console.log()` except via IPC helpers in `core/src/utils/ipc.ts`. Use `console.error()` for debugging only.

### Authentication & Security

1. **OAuth2 PKCE Flow**: Interactive browser-based login stores refresh tokens in OS-native keyring
2. **Token Management**: Access tokens obtained fresh for each command by exchanging refresh token
3. **CSRF Protection**: State parameter validation prevents authorization code interception
4. **No Plaintext Storage**: All tokens stored via `keyring` crate with `apple-native` feature
5. **Session Persistence**: TUI auto-verifies session on startup and displays status in bottom bar

### Logging System

- All logs stored in `logs/` directory with session-based naming: `o365-cli_YYYYMMDD_HHMMSS.log`
- Debug level logging with RFC3339 timestamps
- Every session creates a new permanent log file (no overwriting)
- Session ID logged at startup for correlation

## Module System

### Command Naming Convention

Commands follow `{category}:{action}` format:
- `iam:*` - Identity & Access Management (user lifecycle)
- `sec:*` - Security & Compliance (audits, governance)
- `res:*` - Resource Optimization (licenses, devices)
- `rep:*` - Reporting

### Dry-Run Mode

Many commands support `--dry-run` flag:
- `true` (default): Simulates mutations, logs actions but does not execute
- `false`: Executes live changes against Microsoft Graph API

Workers should check this flag and log intentions instead of calling mutation APIs when dry-run is enabled.

## Adding New Commands

### 1. Create TypeScript Worker

Create command file in `core/src/commands/{category}/{command}.ts`:

```typescript
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

export async function myCommand(arg: string) {
  IPC.progress("Starting task...", 0);
  const client = GraphService.getClient(); // Pre-authenticated

  try {
    const data = await client.api('/endpoint').get();

    IPC.success({
      table: {
        headers: ["Column1", "Column2"],
        rows: data.value.map(item => [item.field1, item.field2])
      },
      message: "Task completed successfully"
    });
  } catch (error: any) {
    IPC.error(error.message || "Unknown error");
  }
}
```

### 2. Register in Router

Add case to `core/src/index.ts`:

```typescript
case "category:command":
  const argIndex = subArgs.indexOf("--arg");
  const arg = argIndex !== -1 ? subArgs[argIndex + 1] : "default";
  await myCommand(arg);
  break;
```

### 3. Wire into TUI

- Update `cli/src/app.rs` to add menu entry and `AppAction::RunTask` payload
- Update `cli/src/ui.rs` to display command in appropriate tab

## Key Files

**Rust CLI:**
- `cli/src/main.rs` - Entry point, arg parsing, TUI/headless mode routing
- `cli/src/app.rs` - Application state, input handlers, action dispatch
- `cli/src/auth.rs` - OAuth2 PKCE implementation, keyring token storage
- `cli/src/runner.rs` - Worker spawning, stdin token passing, stdout IPC parsing
- `cli/src/tui.rs` - Terminal setup/teardown, event loop
- `cli/src/ui.rs` - Ratatui widget rendering and layout
- `cli/src/profile.rs` - User profile persistence after login

**TypeScript Workers:**
- `core/src/index.ts` - Command router (main worker entry point)
- `core/src/utils/ipc.ts` - IPC message helpers
- `core/src/services/graph.ts` - Singleton Microsoft Graph client
- `core/src/commands/iam/offboard.ts` - IAM offboarding implementation (reference example)
- `core/src/commands/sec/shadow-it.ts` - Security audit implementation

## Common Pitfalls

1. **Stdout Pollution**: Workers must only write IPC JSON to stdout. Use `console.error()` for debug logging, never `console.log()`
2. **Router Registration**: New workers are unreachable unless added to switch statement in `core/src/index.ts`
3. **Path Resolution**: Code runs from both project root and `cli/` subdirectory - use `std::env::current_dir()` for dynamic path resolution
4. **Graph Permissions**: Verify Azure App Registration has required delegated permissions for worker operations
5. **TUI Freezing**: Avoid long-running sync operations in Rust TUI loop - spawn async tasks or background threads

## Implementation Status

Current module implementation status:

| Module | TypeScript Worker | TUI Integration |
|--------|------------------|-----------------|
| IAM Offboarding (`iam:offboard`) | ✅ Complete | 🚧 In Progress |
| Shadow IT (`sec:shadow-it`) | ✅ Enhanced | ✅ Complete |
| Guest Cleanup (`iam:guest-cleanup`) | ✅ Complete | ❌ Planned |
| License Optimization | ❌ Planned | ❌ Planned |
| Device Cleanup | ❌ Planned | ❌ Planned |
| External Sharing Audit | ❌ Planned | ❌ Planned |

See `README.md` for full module roadmap and business objectives.

## Development Workflow

1. **Rust Changes**: Rebuild CLI with `cargo build --release --manifest-path cli/Cargo.toml`
2. **TypeScript Changes**: No build step required - Bun executes `.ts` files directly
3. **Testing IPC**: Run headless mode commands to test worker output without TUI
4. **Session Logs**: Check `logs/` directory for detailed execution traces with Graph API calls
