# Track Plan: Orchestration Migration (Rust to TS/Bash)

## Phase 1: Orchestrator Architecture & Prototype [checkpoint: cfe2425]
- [x] Task: Design TypeScript CLI Entry Point [90cbffd]
    - Context: Create `core/src/cli.ts` or a new `cli-ts/` package.
    - Sub-task: Implement command-line argument parsing (e.g., using `commander` or `yargs`).
- [x] Task: Implement Task Discovery Mechanism [97d6d8b]
    - Context: Dynamic loading of modules from `core/src/commands`.
- [x] Task: Conductor - User Manual Verification 'Orchestrator Prototype'

## Phase 2: Auth & Security Port
- [x] Task: Port OAuth2 PKCE Flow to TypeScript [24b4f64]
    - Context: Move logic from `cli/src/auth.rs` to a TS service.
    - Sub-task: Use `open` for browser handling and a local HTTP server for redirect.
- [x] Task: Secure Token Management [d5ab2d0]
    - Context: Implement keyring integration (e.g., `node-keytar` or equivalent for Bun).
- [ ] Task: Conductor - User Manual Verification 'Auth Port'

## Phase 3: Task Execution Engine [checkpoint: 18f48b4]
- [x] Task: Implement Worker Runner [f3081f3]
    - Context: Logic to spawn and manage `bun` processes for tasks.
- [x] Task: Rich CLI/TUI Output [820a59e]
    - Context: Re-implement table rendering and progress bars (e.g., using `ink` or `cli-table3`).
- [x] Task: Conductor - User Manual Verification 'Execution Engine'

## Phase 4: Migration & Deprecation
- [x] Task: Port All Existing Modules to New Runner [9f6f53b]
- [x] Task: Final System Verification [ca4e2e3]
- [~] Task: Deprecate Rust CLI Directory
    - Context: Archive `cli/` and update build scripts.
- [ ] Task: Conductor - User Manual Verification 'Final Migration'
