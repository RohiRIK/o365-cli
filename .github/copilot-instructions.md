# o365-cli Developer Instructions

## Architecture Overview

This is a **hybrid Rust + TypeScript** project for Microsoft 365 administration. The architecture splits responsibilities:

- **Rust CLI (`cli/`)**: Handles OAuth2 PKCE flow, secure token storage (keyring), and renders an interactive TUI using Ratatui. Acts as the orchestrator.
- **TypeScript Workers (`core/`)**: Execute Microsoft Graph API logic via Bun runtime. Workers are spawned by Rust as child processes and communicate via JSON-over-stdout IPC.

**Key Insight**: The Rust binary never touches the Graph API directly. It delegates all M365 operations to TypeScript workers, passing the OAuth token via `GRAPH_TOKEN` environment variable.

## Critical Workflows

### Building & Running

```bash
# Build Rust CLI (from project root)
cd cli && cargo build --release

# Run TUI (no args launches interactive mode)
./cli/target/release/o365-cli

# Run specific command
./cli/target/release/o365-cli run sec:shadow-it --dry-run false

# Login (manual auth flow)
./cli/target/release/o365-cli login --tenant common
```

**Important**: The TypeScript workers are NOT bundled. The Rust runner expects `core/src/index.ts` to exist and spawns `bun run` directly. Ensure Bun is installed (`brew install oven-sh/bun/bun`).

### Testing TypeScript Workers Standalone

Workers can be tested without the Rust TUI by manually setting `GRAPH_TOKEN`:

```bash
export GRAPH_TOKEN="<your_token_here>"
bun run core/src/index.ts sec:shadow-it --dry-run true
```

## Adding New Commands

### 1. Create TypeScript Worker

Add command handler in `core/src/commands/{category}/{command}.ts`:

```typescript
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

export async function myNewCommand(arg: string) {
  IPC.progress("Starting...", 0);
  const client = GraphService.getClient();
  
  try {
    // Make Graph API calls
    const data = await client.api('/users').get();
    
    // Return structured data for TUI rendering
    IPC.success({
      table: {
        headers: ["Name", "Email"],
        rows: data.value.map(u => [u.displayName, u.userPrincipalName])
      },
      message: "Command completed successfully"
    });
  } catch (error: any) {
    IPC.error(error.message);
  }
}
```

### 2. Register Command Router

Update `core/src/index.ts` to handle the new command:

```typescript
case "category:command":
  const arg = subArgs[subArgs.indexOf("--arg") + 1];
  await myNewCommand(arg);
  break;
```

### 3. Wire into Rust TUI

Add menu entry in `cli/src/app.rs` and `cli/src/ui.rs` to trigger:

```rust
AppAction::RunTask { 
  name: "category:command".to_string(), 
  args: vec!["--arg".to_string(), value] 
}
```

## IPC Protocol

Workers communicate with Rust via **JSON-over-stdout**. Three message types:

```typescript
// Progress updates (non-blocking)
IPC.progress("Fetching users...", 25);

// Success result (terminates task)
IPC.success({ table: { headers: [...], rows: [...] } });

// Fatal error (exits with code 1)
IPC.error("User not found");
```

**Rust Parser**: `cli/src/runner.rs` reads stdout line-by-line, deserializing into `IpcMessage` enum. Table data is automatically rendered in TUI as a `comfy-table`.

## Authentication Flow

1. User runs `o365-cli login` or presses `L` in TUI
2. Rust generates PKCE challenge and opens browser to Microsoft login
3. Local HTTP server (localhost:8000) captures redirect with auth code
4. Token exchange happens in Rust using `oauth2` crate
5. Access token stored in `.o365_cli_token` (plaintext file in `cli/` directory)
6. On subsequent runs, token is loaded from cache and injected into `GRAPH_TOKEN` env var for workers

**Client ID**: Uses Microsoft's official "Microsoft Graph PowerShell" app ID (`14d82eec-204b-4c2f-b7e8-296a70dab67e`) by default. Override with `AZURE_CLIENT_ID` env var.

## Project-Specific Conventions

### Command Naming

Format: `{category}:{action}` where:
- `iam:*` = Identity & Access Management (user lifecycle)
- `sec:*` = Security & Compliance (audits, governance)
- `res:*` = Resource Optimization (licenses, devices)
- `rep:*` = Reporting

Example: `sec:shadow-it`, `iam:offboard`

### Token Caching

Token persistence uses a **file-based cache** at `cli/.o365_cli_token` (NOT the system keyring despite `keyring` dependency). Token refresh is NOT implemented—users must re-authenticate when expired.

### Dry-Run Mode

Many commands support `--dry-run` flag. When true:
- Graph API mutations (POST/PATCH/DELETE) are **simulated** (logged but not executed)
- Read operations (GET) execute normally
- Implementation: Worker functions should check the flag and log instead of calling mutation APIs

### Legacy Scripts

`legacy/` contains original PowerShell automation scripts. These are **reference implementations**—the Rust/TS version should replicate their logic. Each folder has a README documenting the workflow (e.g., mailbox conversion, license reclamation).

## Common Pitfalls

1. **Forgetting to update `core/src/index.ts` router**: New worker functions won't be reachable unless registered in the switch statement.

2. **Hardcoded paths**: The codebase handles running from both project root and `cli/` subdirectory. Use `std::env::current_dir()` checks in Rust (see `runner.rs` line 31).

3. **Missing Graph permissions**: Workers fail silently if the OAuth token lacks required scopes. Check Azure App Registration for delegated permissions (User.Read.All, Directory.ReadWrite.All, etc.).

4. **Stdout pollution**: Workers MUST only write IPC JSON to stdout. Use `console.error()` for debugging, never `console.log()`.

## Key Files Reference

- `cli/src/auth.rs`: OAuth2 PKCE implementation, token storage
- `cli/src/runner.rs`: Spawns Bun workers, parses IPC messages
- `cli/src/tui.rs`: Terminal setup, event loop, session validation
- `cli/src/app.rs`: Application state machine, keyboard input handlers
- `core/src/index.ts`: Command router (entrypoint for workers)
- `core/src/utils/ipc.ts`: IPC message helpers
- `core/src/services/graph.ts`: Singleton Microsoft Graph client
