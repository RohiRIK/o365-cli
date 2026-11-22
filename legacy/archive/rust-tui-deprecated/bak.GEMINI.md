# O365 CLI - Microsoft 365 Administration Toolset

This project is a Rust-based Command Line Interface (CLI) tool designed for administering Microsoft 365, Azure Active Directory (now Entra ID), and Exchange. It aims to provide a robust and interactive way to manage various aspects of these services directly from the terminal.

## Project Overview

The `o365-cli` acts as a frontend for a collection of administrative tasks implemented as external TypeScript modules. The core functionality includes:

*   **Authentication (`Login`):** Securely authenticating with Microsoft Entra ID.
*   **Task Execution (`Run`):** Executing specific administrative tasks (e.g., `iam:offboard`) with provided arguments. These tasks are run by spawning `bun` processes that execute TypeScript code.
*   **Interactive Mode:** A Terminal User Interface (TUI) for a more interactive administration experience when no specific commands are provided.
*   **Inter-Process Communication (IPC):** The Rust CLI communicates with the external TypeScript workers using a structured JSON-based IPC mechanism, allowing for progress updates, structured data output (including tables), and error reporting.

## Building and Running

### Prerequisites

*   **Rust:** Ensure you have the Rust toolchain installed. You can install it via `rustup`.
*   **Bun:** The `bun` runtime is required for executing the administrative tasks. Install it globally.

### Building the Project

To build the `o365-cli` executable:

```bash
cargo build --release
```

The executable will be located in `target/release/o365-cli`.

### Running the Project

You can run the CLI in several ways:

1.  **Interactive Mode:**
    If you run the executable without any arguments, it will launch into an interactive TUI mode.

    ```bash
    ./target/release/o365-cli
    # or
    cargo run
    ```

2.  **Login to Microsoft Entra ID:**
    Authenticate your session to access Microsoft 365 services.

    ```bash
    ./target/release/o365-cli login --tenant <YOUR_TENANT_ID>
    # Example:
    cargo run login --tenant common
    ```

3.  **Run a Specific Task:**
    Execute a predefined administrative task. Tasks are identified by a module name (e.g., `iam:offboard`).

    ```bash
    ./target/release/o365-cli run <task_name> [task_arguments...]
    # Example: To run an IAM offboarding task with specific arguments
    cargo run run iam:offboard --user user@example.com --dry-run
    ```

## Development Conventions

*   **Language:** The CLI frontend is written in **Rust**. Administrative tasks (workers) are written in **TypeScript** and executed using the **Bun** runtime.
*   **CLI Argument Parsing:** The `clap` crate is used for defining and parsing command-line arguments and subcommands in Rust.
*   **Output Formatting:** The `comfy-table` crate is utilized for rendering tabular data in the terminal, providing a structured and readable output for task results.
*   **Modularity:** Core administrative logic is decoupled from the Rust CLI, residing in external TypeScript modules that can be updated independently.
*   **IPC Protocol:** A JSON-based inter-process communication protocol is used between the Rust CLI and the Bun workers to convey progress, success data, and errors.
