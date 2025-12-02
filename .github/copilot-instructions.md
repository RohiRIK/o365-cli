# 🧑‍💻 o365-cli Developer Instructions

## 🚀 Vision & Architecture Overview

This project implements a **sophisticated hybrid Rust + TypeScript** architecture for Microsoft 365 administration. The core principle is a clear separation of concerns, leveraging each language for its strengths:

-   **The Brain (Rust CLI - `cli/`):**
    *   **Orchestration & UX:** Manages the entire application lifecycle, user input, and renders a rich, interactive **TUI (Terminal User Interface)** using `Ratatui`.
    *   **Secure Authentication:** Handles **OAuth2 PKCE** flow, secure token storage via OS-specific **keyring** mechanisms, and token validation.
    *   **Inter-Process Communication (IPC):** Spawns and communicates with TypeScript workers, directing commands and processing their structured JSON output.

-   **The Muscle (TypeScript Workers - `core/`):**
    *   **Business Logic & Graph API Interaction:** Executes all Microsoft Graph API logic and complex data processing.
    *   **Runtime:** Powered by the **Bun** runtime for high-performance script execution.
    *   *Key Insight:* The Rust binary never touches the Graph API directly. It delegates all M365 operations to these TypeScript workers, securely passing the OAuth token.

---

## 🏗️ Core Workflows

### Building & Running the TUI Application

To experience the full interactive dashboard:

```bash
# Ensure Rust toolchain is installed (https://rustup.rs/)
# Ensure Bun runtime is installed (brew install oven-sh/bun/bun)

# Navigate to the CLI directory and build
cd cli && cargo build --release

# Run the TUI (no arguments launches interactive dashboard mode)
./target/release/o365-cli
```

### Running Specific CLI Commands (Headless)

For scripting or integrating into other tools, you can run specific tasks directly without the TUI:

```bash
# Example: Run a Shadow IT audit
./cli/target/release/o365-cli run sec:shadow-it --dry-run false

# Perform a manual login outside the TUI
./cli/target/release/o365-cli login --tenant common
```

**Important**: TypeScript workers are NOT bundled. The Rust runner expects `core/src/index.ts` to exist.

---

## ➕ Extending the Platform: Adding New Modules

The modular design makes it straightforward to add new administrative commands.

### 1. Create TypeScript Worker (`core/src/commands/{category}/{command}.ts`)

This is where your M365 business logic resides.

```typescript
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

export async function myNewCommand(arg: string) {
  IPC.progress("Starting my new command...", 0);
  const client = GraphService.getClient(); // Client is pre-authenticated with token
  
  try {
    // Perform Graph API calls or other logic
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
    // Report errors back to the Rust CLI
    IPC.error(error.message || "Unknown error during myNewCommand");
  }
}
```

### 2. Register Command in TypeScript Router (`core/src/index.ts`)

Add a case to the `switch` statement to route to your new worker function.

```typescript
case "category:command":
  // Parse arguments specific to your command
  const arg = subArgs[subArgs.indexOf("--arg") + 1]; 
  await myNewCommand(arg);
  break;
```

### 3. Wire into Rust TUI Frontend (`cli/src/app.rs` & `cli/src/ui.rs`)

Integrate your new command into the interactive dashboard.

*   **`cli/src/app.rs`**: Add a menu entry and define the `AppAction::RunTask` payload.
    ```rust
    // In execute_action, under the relevant tab
    Some(AppAction::RunTask { 
      name: "category:command".to_string(), 
      args: vec!["--arg".to_string(), value] 
    })
    ```
*   **`cli/src/ui.rs`**: Add the new command to the list of items to be displayed in the TUI.

---

## 🔄 Inter-Process Communication (IPC) Protocol

Workers communicate with the Rust CLI primarily via **JSON-over-stdout**. The authentication token is passed securely to workers via **stdin**.

### Stdin (Rust → TypeScript)

```typescript
// Worker reads token from stdin on startup (handled by GraphService.initialize())
```

### Stdout (TypeScript → Rust)

Workers MUST only output structured JSON messages to `stdout`. Use `IPC` helpers.

```typescript
// Progress updates (displayed in TUI logs pane)
IPC.progress("Fetching users...", 25);

// Success result (renders in the main content pane)
IPC.success({ table: { headers: [...], rows: [...] }, message: "Operation done" });

// Fatal error (displayed in TUI logs pane and aborts task)
IPC.error("User not found: specific_user@domain.com");
```

**Rust Parser**: `cli/src/runner.rs` handles writing the token to stdin and reading/deserializing structured `IpcMessage` from stdout.

---

## 🔐 Authentication & Session Management

The platform employs robust, secure authentication:

1.  **Flow:** Utilizes **OAuth2 Authorization Code Flow with PKCE** for secure, interactive login.
2.  **User Experience:** Triggered via `o365-cli login` or the **Login** option in the TUI's **Settings** tab. A local HTTP server captures the redirect.
3.  **Token Storage:**
    *   **Refresh Tokens** are securely stored in the **OS-specific keyring** (`macOS Keychain`, `Windows Credential Manager`, `Linux Secret Service`) via the `keyring` crate. **No plaintext storage.**
    *   **Access Tokens** are obtained fresh for each command execution by exchanging the refresh token.
4.  **Auto-Verification:** The TUI proactively verifies the session status on startup, providing visual feedback (`Auth: ✅ Active` / `Auth: ❌ Expired`) in the bottom status bar.
5.  **Session Persistence:** If a profile is stored, the TUI automatically loads and attempts to verify the session upon launch, making re-login less frequent.
6.  **Data Display:** The Settings tab provides detailed tenant and user information extracted directly from the authenticated token.

**Security Notes**:
-   **CSRF Validation** prevents authorization code interception attacks.
-   **Tokens passed via stdin** to TypeScript workers, avoiding exposure in process listings.
-   **Refresh tokens automatically rotated** and updated in the keyring.
-   **Client ID**: Uses Microsoft's official "Microsoft Graph PowerShell" app ID by default.

---

## 🗺️ Project-Specific Conventions

### Command Naming

Follows a `{category}:{action}` format:
-   `iam:*` = Identity & Access Management (user lifecycle)
-   `sec:*` = Security & Compliance (audits, governance)
-   `res:*` = Resource Optimization (licenses, devices)
-   `rep:*` = Reporting

Example: `sec:shadow-it`, `iam:offboard`

### Dry-Run Mode

Many commands support a `--dry-run` flag:
-   When `true`: Graph API mutations (POST/PATCH/DELETE) are **simulated** (logged but not executed).
-   When `false`: Operations **execute live**.
-   **Implementation:** Worker functions should check this flag and log instead of calling mutation APIs. The TUI's **Settings** tab provides an easy toggle.

### Legacy Scripts (`legacy/`)

Contains original PowerShell automation scripts. These serve as **reference implementations** for porting to the Rust/TS hybrid. Each folder now contains an enriched `README.md` detailing its vision, features, and future roadmap.

---

## 📊 Module Implementation Status

This matrix provides a high-level overview of each module's development progress across the platform components.

| Module ID | Module Name | Legacy (PowerShell) | Core (TypeScript) | TUI Integration (Rust) |
| :--- | :--- | :---: | :---: | :---: |
| **IAM-01** | Graceful Offboarding | ✅ Stable | 🚧 In Progress | ❌ Planned |
| **IAM-01-G** | Guest User Cleanup | ✅ Stable | ❌ Planned | ❌ Planned |
| **IAM-01-N** | New User Onboarding | 🚧 Partial | ❌ Planned | ❌ Planned |
| **SEC-02-S** | Shadow IT Governance | ✅ Stable | ✅ Production | ✅ Accessible |
| **SEC-02-K** | Surgical Lockdown | ✅ Stable | ❌ Planned | ❌ Planned |
| **SEC-02** | External Sharing Audit | ✅ Stable | ❌ Planned | ❌ Planned |
| **SEC-02-M** | Mailbox Permissions | ❌ Planned | ❌ Planned | ❌ Planned |
| **RES-03** | License Optimization | ✅ Stable | ❌ Planned | ❌ Planned |
| **RES-03-D** | Stale Device Cleanup | ✅ Stable | ❌ Planned | ❌ Planned |
| **REP-04** | 360° User Analyzer | ✅ Stable | ❌ Planned | ❌ Planned |
| **REP-04-T** | Teams Sprawl Report | ❌ Planned | ❌ Planned | ❌ Planned |

**Legend:**
*   ✅ **Stable/Production:** Fully functional and tested.
*   🚧 **In Progress:** Code exists but may be incomplete or beta.
*   ❌ **Planned:** Specified in architecture but implementation not started.

---

## ⚠️ Common Pitfalls

1.  **`core/src/index.ts` Router:** New worker functions won't be reachable unless registered in the TypeScript command router.
2.  **Hardcoded Paths:** The codebase is designed to run from both the project root and the `cli/` subdirectory. Use `std::env::current_dir()` for path resolution.
3.  **Missing Graph Permissions:** Workers will fail if the OAuth token lacks required scopes. Verify delegated permissions in your Azure App Registration.
4.  **Stdout Pollution:** Workers MUST only write structured IPC JSON to `stdout`. Use `console.error()` for debugging, never `console.log()` outside of IPC.
5.  **TUI Freezing:** Avoid long-running synchronous operations directly in the Rust TUI loop. For intensive tasks, consider spawning background threads or async tasks that communicate via channels.

---

## 📄 Key Files Reference

-   **`cli/src/app.rs`**: Core application state, input handlers, and action dispatch.
-   **`cli/src/auth.rs`**: OAuth2 PKCE implementation, token acquisition and storage (OS keyring).
-   **`cli/src/profile.rs`**: Local user profile persistence (saving and loading user details after login).
-   **`cli/src/runner.rs`**: Spawns Bun workers, pipes token via stdin, and parses structured IPC messages from stdout.
-   **`cli/src/tui.rs`**: Terminal setup/teardown, main event loop, and real-time UI rendering orchestration.
-   **`cli/src/ui.rs`**: Ratatui widget rendering logic, dashboard layout, and styles.
-   **`core/src/index.ts`**: TypeScript command router (main entry point for workers).
-   **`core/src/utils/ipc.ts`**: TypeScript helpers for structured JSON-over-stdout IPC.
-   **`core/src/services/graph.ts`**: Singleton Microsoft Graph client for TypeScript workers.