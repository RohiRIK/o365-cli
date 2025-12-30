# Track Plan: Orchestration Migration (Rust to TS/Bash)

## Phase 1: Orchestrator Architecture & Prototype [checkpoint: cfe2425]
- [x] Task: Design TypeScript CLI Entry Point [90cbffd]
    - Context: Create `core/src/cli.ts` or a new `cli-ts/` package.
    - Sub-task: Implement command-line argument parsing (e.g., using `commander` or `yargs`).
- [x] Task: Implement Task Discovery Mechanism [97d6d8b]
    - Context: Dynamic loading of modules from `core/src/commands`.
- [x] Task: Conductor - User Manual Verification 'Orchestrator Prototype'

## Phase 2: Auth & Security Port
- [ ] Task: Port OAuth2 PKCE Flow to TypeScript
    - Context: Move logic from `cli/src/auth.rs` to a TS service.
    - Sub-task: Use `open` for browser handling and a local HTTP server for redirect.
- [ ] Task: Secure Token Management
    - Context: Implement keyring integration (e.g., `node-keytar` or equivalent for Bun).
- [ ] Task: Conductor - User Manual Verification 'Auth Port'

## Phase 3: Task Execution Engine
- [ ] Task: Implement Worker Runner
    - Context: Logic to spawn and manage `bun` processes for tasks.
- [ ] Task: Rich CLI/TUI Output
    - Context: Re-implement table rendering and progress bars (e.g., using `ink` or `cli-table3`).
- [ ] Task: Conductor - User Manual Verification 'Execution Engine'

## Phase 4: Migration & Deprecation
- [ ] Task: Port All Existing Modules to New Runner
- [ ] Task: Final System Verification
- [ ] Task: Deprecate Rust CLI Directory
    - Context: Archive `cli/` and update build scripts.
- [ ] Task: Conductor - User Manual Verification 'Final Migration'
