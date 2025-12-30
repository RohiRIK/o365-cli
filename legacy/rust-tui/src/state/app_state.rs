use crossterm::event::KeyCode;
use ratatui::widgets::ListState;
use chrono::{DateTime, Utc};
use crate::profile::UserProfile;
use crate::runner::TaskOutput;
use super::{NavigationState, ConfigState, HealthMetrics};

/// Main application state
pub struct AppState {
    // Delegated state modules
    pub navigation: NavigationState,
    pub config: ConfigState,
    pub health: HealthMetrics,

    // UI state
    pub focus: FocusState,
    pub modal: ModalState,

    // Auth
    pub user_profile: Option<UserProfile>,
    pub auth_status: AuthStatus,
    pub token_expiry_countdown: Option<String>,
    pub token_expires_at: Option<DateTime<Utc>>,
    #[allow(dead_code)] // Used in profile.rs, will be used for multi-tenant support
    pub tenant_id: String,
    pub login_rx: Option<std::sync::mpsc::Receiver<crate::login_handler::LoginUpdate>>,

    // Task execution
    pub task_output: Option<TaskOutput>,

    // Input buffers
    pub input_buffer: String,
    pub filter_buffer: String,

    // Logs
    pub logs: Vec<String>,
    pub logs_state: ListState,

    // Control
    pub should_quit: bool,
    pub is_loading: bool,
}

/// Focus state for different UI sections
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum FocusState {
    CategoryTree,      // Left sidebar (category navigation)
    ModuleList,        // Right pane (module list with enable/disable)
    SettingsDashboard, // Settings view
    Logs,              // Log viewer
}

/// Modal overlay state
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)] // Scaffolding for future module execution features
pub enum ModalState {
    None,
    Input(InputContext),
    /// Dynamic input collection modal driven by modules.toml
    ModuleInput {
        module_id: String,
        module_name: String,
        inputs: Vec<crate::modules::InputDefinition>,
        current_input_index: usize,
        collected_values: std::collections::HashMap<String, String>,
        buffer: String,
        error_message: Option<String>,
    },
    /// Execution progress modal showing IPC output
    ExecutionProgress {
        module_id: String,
        module_name: String,
        progress: u8,
        message: String,
        logs: Vec<String>,
    },
    Review { task_name: String, args: Vec<String> },
    Confirm(ConfirmAction),
    ModuleDetail(String), // module_id
    Filter,
    /// OAuth login flow modal
    LoginFlow {
        stage: LoginStage,
        auth_url: Option<String>,
        message: String,
        error: Option<String>,
    },
}

/// Login flow stages
#[derive(Debug, Clone, PartialEq)]
pub enum LoginStage {
    Initializing,
    WaitingForBrowser,
    PollingForToken,
    Success,
    Failed,
}

/// Multi-step input context
#[derive(Debug, Clone, PartialEq)]
#[allow(dead_code)] // Scaffolding for future module input collection
pub enum InputContext {
    None,
    OffboardUserEmail,
    OffboardManagerEmail { user_email: String },
    OffboardDeviceAction { user_email: String, manager_email: Option<String> },
    GuestCleanupThreshold,
}

/// Confirm actions (for destructive operations)
#[derive(Debug, Clone, PartialEq)]
pub enum ConfirmAction {
    ClearTaskHistory,
    ClearTokenCache,
    DisableAllModules,
}

/// Authentication status
#[derive(Debug, Clone)]
#[allow(dead_code)] // Scaffolding for future auth state transitions
pub enum AuthStatus {
    Unknown,
    Refreshing,
    Valid(String),
    Invalid(String),
}

impl AppState {
    /// Create new application state
    pub fn new() -> Self {
        let user_profile = UserProfile::load();
        let tenant_id = user_profile
            .as_ref()
            .map(|p| p.tenant_id.clone())
            .unwrap_or_else(|| "Not Connected".to_string());

        let mut health = HealthMetrics::new();
        if let Some(ref profile) = user_profile {
            health.detect_environment(&profile.tenant_id);
        }

        Self {
            navigation: NavigationState::new(),
            config: ConfigState::default(),
            health,

            focus: FocusState::CategoryTree,
            modal: ModalState::None,

            user_profile,
            auth_status: AuthStatus::Unknown,
            token_expiry_countdown: None,
            token_expires_at: None,
            tenant_id,
            login_rx: None,

            task_output: None,

            input_buffer: String::new(),
            filter_buffer: String::new(),

            logs: vec!["Welcome to o365-cli TUI v2.0".to_string()],
            logs_state: ListState::default(),

            should_quit: false,
            is_loading: false,
        }
    }

    /// Add a log message
    pub fn add_log(&mut self, message: String) {
        self.logs.push(message);
        // Auto-scroll to bottom
        if !self.logs.is_empty() {
            self.logs_state.select(Some(self.logs.len() - 1));
        }
    }

    /// Clear task results and return to module list
    #[allow(dead_code)] // Will be used in future results viewing
    pub fn back_to_menu(&mut self) {
        self.task_output = None;
        self.filter_buffer.clear();
        self.focus = FocusState::ModuleList;
    }

    /// Execute a module with given arguments
    /// This will be called either from direct execution (no inputs) or after input collection
    pub fn execute_module(&mut self, module_id: String, mut args: Vec<String>) {
        // Get module display name for progress modal
        let registry = crate::modules::MODULE_REGISTRY.lock().unwrap();
        let module_name = registry.config.get_module(&module_id)
            .map(|m| m.display_name.clone())
            .unwrap_or_else(|| module_id.clone());
        drop(registry);

        // Add dry-run flag if not already present
        if !args.iter().any(|arg| arg == "--dry-run") {
            args.push("--dry-run".to_string());
            args.push(self.config.execution.default_dry_run.to_string());
        }

        // Set execution progress modal
        self.modal = ModalState::ExecutionProgress {
            module_id: module_id.clone(),
            module_name: module_name.clone(),
            progress: 0,
            message: "Initializing...".to_string(),
            logs: vec![],
        };
        self.is_loading = true;

        // Get OAuth token
        let tenant = self.tenant_id.clone();
        let token_result: anyhow::Result<String> = (|| {
            let rt = tokio::runtime::Runtime::new()
                .map_err(|e| anyhow::anyhow!("Failed to create runtime: {}", e))?;
            rt.block_on(async {
                let auth = crate::auth::AuthManager::new(&tenant)?;
                auth.get_access_token().await
            })
        })();

        let token = match token_result {
            Ok(t) => t,
            Err(e) => {
                self.add_log(format!("❌ Failed to get access token: {}", e));
                self.modal = ModalState::None;
                self.is_loading = false;
                return;
            }
        };

        // Execute task synchronously (TODO: make async with background thread)
        let mut execution_logs = Vec::new();
        let result = crate::runner::run_task(&module_id, &args, &token, |msg| {
            execution_logs.push(msg.clone());
            // Update modal progress (this won't actually show until after completion in sync mode)
            // In future async implementation, this will update in real-time
        });

        // Handle result
        match result {
            Ok(output) => {
                self.task_output = Some(output.clone());
                self.add_log(format!("✅ Module '{}' completed successfully", module_name));
                if let Some(msg) = &output.message {
                    self.add_log(msg.clone());
                }
                // Close modal and show results
                self.modal = ModalState::None;
            }
            Err(e) => {
                self.add_log(format!("❌ Module '{}' failed: {}", module_name, e));
                // Show error in modal
                self.modal = ModalState::ExecutionProgress {
                    module_id,
                    module_name,
                    progress: 0,
                    message: format!("Error: {}", e),
                    logs: execution_logs,
                };
            }
        }

        self.is_loading = false;
    }

    /// Initiate OAuth login flow from TUI
    pub fn initiate_login(&mut self, tenant: Option<String>) {
        let tenant = tenant.unwrap_or_else(|| "common".to_string());
        self.add_log(format!("🔐 Starting authentication for tenant: {}", tenant));

        // Spawn background login handler
        let rx = crate::login_handler::spawn_login_handler(tenant);
        self.login_rx = Some(rx);

        // Set login modal to initializing state
        self.modal = ModalState::LoginFlow {
            stage: LoginStage::Initializing,
            auth_url: None,
            message: "Preparing login...".to_string(),
            error: None,
        };
    }

    /// Update login flow state (called by login handler)
    pub fn update_login_state(&mut self, stage: LoginStage, auth_url: Option<String>, message: String, error: Option<String>) {
        self.modal = ModalState::LoginFlow {
            stage,
            auth_url,
            message,
            error,
        };
    }

    /// Handle successful login
    pub fn complete_login(&mut self, tenant_id: String, user_principal: String) {
        self.tenant_id = tenant_id.clone();
        self.auth_status = AuthStatus::Valid("Authenticated".to_string());
        self.add_log(format!("✅ Login successful! User: {}", user_principal));

        // Show success modal briefly
        self.modal = ModalState::LoginFlow {
            stage: LoginStage::Success,
            auth_url: None,
            message: format!("Login successful!\nUser: {}", user_principal),
            error: None,
        };
    }

    /// Handle failed login
    pub fn fail_login(&mut self, error: String) {
        self.add_log(format!("❌ Login failed: {}", error));
        self.modal = ModalState::LoginFlow {
            stage: LoginStage::Failed,
            auth_url: None,
            message: "Login failed".to_string(),
            error: Some(error),
        };
    }

    /// Check for login updates from background thread
    pub fn check_login_updates(&mut self) {
        if let Some(ref rx) = self.login_rx {
            if let Ok(update) = rx.try_recv() {
                match update {
                    crate::login_handler::LoginUpdate::Stage { stage, auth_url, message, error } => {
                        self.update_login_state(stage, auth_url, message, error);
                    }
                    crate::login_handler::LoginUpdate::Success { tenant_id, user_principal } => {
                        self.complete_login(tenant_id, user_principal);
                        self.login_rx = None; // Clear the receiver
                    }
                    crate::login_handler::LoginUpdate::Failed { error } => {
                        self.fail_login(error);
                        self.login_rx = None; // Clear the receiver
                    }
                }
            }
        }
    }

    /// Called on every tick - updates countdown timers, animations, etc.
    pub fn on_tick(&mut self) {
        // Update token expiry countdown
        if let Some(expires_at) = self.token_expires_at {
            self.token_expiry_countdown = Some(crate::auth::calculate_expiry_countdown(expires_at));

            // Check if token is expired or expiring soon
            if crate::auth::is_token_expired(expires_at) {
                self.auth_status = AuthStatus::Invalid("Token expired".to_string());
            } else if crate::auth::is_token_expiring_soon(expires_at) {
                // Warning state - but still valid
                if let AuthStatus::Valid(_) = self.auth_status {
                    self.auth_status = AuthStatus::Valid("Expiring soon".to_string());
                }
            }
        }
    }

    /// Update token expiration time after authentication
    #[allow(dead_code)] // Used by parse_and_store_token, will be used in TUI login
    pub fn set_token_expiry(&mut self, expires_at: DateTime<Utc>) {
        self.token_expires_at = Some(expires_at);
        self.token_expiry_countdown = Some(crate::auth::calculate_expiry_countdown(expires_at));
    }

    /// Parse and store token information
    #[allow(dead_code)] // Will be used in TUI login implementation
    pub fn parse_and_store_token(&mut self, token: &str) -> anyhow::Result<()> {
        let parsed = crate::auth::parse_access_token(token)?;

        // Update auth status
        self.auth_status = AuthStatus::Valid("Active".to_string());

        // Update token expiration
        self.set_token_expiry(parsed.expires_at);

        // Update user profile if needed
        if self.user_profile.is_none() {
            self.user_profile = Some(UserProfile {
                name: parsed.claims.name.clone().unwrap_or_else(|| "Unknown".to_string()),
                email: parsed.user_email.clone(),
                tenant_id: parsed.tenant_id.clone(),
                scopes: parsed.scopes.clone(),
                last_login: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            });
        }

        Ok(())
    }

    /// Update health metrics from background health monitor
    pub fn update_health(&mut self, latency_ms: u64) {
        self.health.update_latency(latency_ms);
    }

    /// Cycle focus to next section
    pub fn cycle_focus_forward(&mut self) {
        self.focus = match self.focus {
            FocusState::CategoryTree => FocusState::ModuleList,
            FocusState::ModuleList => FocusState::SettingsDashboard,
            FocusState::SettingsDashboard => FocusState::Logs,
            FocusState::Logs => FocusState::CategoryTree,
        };
    }

    /// Cycle focus to previous section
    pub fn cycle_focus_backward(&mut self) {
        self.focus = match self.focus {
            FocusState::CategoryTree => FocusState::Logs,
            FocusState::Logs => FocusState::SettingsDashboard,
            FocusState::SettingsDashboard => FocusState::ModuleList,
            FocusState::ModuleList => FocusState::CategoryTree,
        };
    }

    /// Check if currently viewing settings
    #[allow(dead_code)] // Useful helper for conditional rendering
    pub fn is_settings_view(&self) -> bool {
        self.focus == FocusState::SettingsDashboard
    }

    /// Handle keyboard input based on current state
    pub fn on_key(&mut self, key: KeyCode) {
        // Global keys
        match key {
            KeyCode::Char('q') => {
                self.should_quit = true;
                return;
            }
            KeyCode::Tab => {
                self.cycle_focus_forward();
                return;
            }
            KeyCode::BackTab => {
                self.cycle_focus_backward();
                return;
            }
            _ => {}
        }

        // Modal-specific keys
        if self.modal != ModalState::None {
            self.handle_modal_key(key);
            return;
        }

        // Focus-specific keys
        match self.focus {
            FocusState::CategoryTree | FocusState::ModuleList => {
                self.handle_navigation_key(key);
            }
            FocusState::SettingsDashboard => {
                self.handle_settings_key(key);
            }
            FocusState::Logs => {
                self.handle_logs_key(key);
            }
        }
    }

    /// Handle navigation keys (category/module selection)
    fn handle_navigation_key(&mut self, key: KeyCode) {
        match key {
            KeyCode::Char('j') | KeyCode::Down => {
                if matches!(self.focus, FocusState::CategoryTree) {
                    self.navigation.next_category();
                } else if matches!(self.focus, FocusState::ModuleList) {
                    let registry = crate::modules::MODULE_REGISTRY.lock().unwrap();
                    let current_category = self.navigation.current_category();
                    let modules = registry.modules_by_category(current_category);
                    self.navigation.next_module(modules.len());
                }
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if matches!(self.focus, FocusState::CategoryTree) {
                    self.navigation.prev_category();
                } else if matches!(self.focus, FocusState::ModuleList) {
                    self.navigation.prev_module();
                }
            }
            KeyCode::Enter => {
                if matches!(self.focus, FocusState::CategoryTree) {
                    // Expand/collapse category
                    self.navigation.toggle_current_category();
                } else if matches!(self.focus, FocusState::ModuleList) {
                    // Execute module - trigger input modal or execute directly
                    let registry = crate::modules::MODULE_REGISTRY.lock().unwrap();
                    let current_category = self.navigation.current_category();
                    let modules = registry.modules_by_category(current_category);
                    if let Some(module_def) = modules.get(self.navigation.current_module_index) {
                        // Special handling for Settings modules - show detail modal instead of executing
                        if current_category == crate::modules::ModuleCategory::Settings {
                            self.modal = ModalState::ModuleDetail(module_def.id.clone());
                        } else if !module_def.supported {
                            // Check if module is supported
                            self.add_log(format!("Module '{}' is not yet implemented", module_def.display_name));
                        } else if module_def.inputs.is_empty() {
                            // No inputs required - execute directly
                            self.add_log(format!("Executing module '{}'...", module_def.display_name));
                            self.execute_module(module_def.id.clone(), vec![]);
                        } else {
                            // Show input collection modal
                            self.modal = ModalState::ModuleInput {
                                module_id: module_def.id.clone(),
                                module_name: module_def.display_name.clone(),
                                inputs: module_def.inputs.clone(),
                                current_input_index: 0,
                                collected_values: std::collections::HashMap::new(),
                                buffer: String::new(),
                                error_message: None,
                            };
                        }
                    }
                }
            }
            // Removed: Space key for toggling enable/disable
            // Removed: 'e' key for enable all
            // Removed: 'd' key for disable all
            // Removed: 'a' key for enable all globally
            // Removed: 'n' key for disable all globally
            KeyCode::Char('/') => {
                // Filter modules
                self.modal = ModalState::Filter;
            }
            KeyCode::Char('i') => {
                // Show module detail
                // (Get current module ID from navigation state)
            }
            KeyCode::Left => {
                // Switch focus to category tree
                self.focus = FocusState::CategoryTree;
            }
            KeyCode::Right => {
                // Switch focus to module list (if category is expanded)
                if self.navigation.is_category_expanded(self.navigation.current_category()) {
                    self.focus = FocusState::ModuleList;
                }
            }
            KeyCode::Char(c @ '1'..='6') => {
                // Jump to category by number
                let index = (c as u8 - b'1') as usize;
                self.navigation.jump_to_category(index);
            }
            _ => {}
        }
    }

    /// Handle settings dashboard keys
    fn handle_settings_key(&mut self, key: KeyCode) {
        match key {
            KeyCode::Char('c') => {
                // Clear task history
                self.modal = ModalState::Confirm(ConfirmAction::ClearTaskHistory);
            }
            KeyCode::Char('t') => {
                // Clear token cache
                self.modal = ModalState::Confirm(ConfirmAction::ClearTokenCache);
            }
            KeyCode::Char('x') => {
                // Export configuration to file
                if let Err(e) = self.export_configuration() {
                    self.add_log(format!("Failed to export configuration: {}", e));
                } else {
                    self.add_log("Configuration exported successfully".to_string());
                }
            }
            KeyCode::Char('r') => {
                // Refresh token
                // (Trigger auth refresh)
            }
            _ => {}
        }
    }

    /// Handle log viewer keys
    fn handle_logs_key(&mut self, key: KeyCode) {
        match key {
            KeyCode::Char('j') | KeyCode::Down => {
                // Scroll down
                if !self.logs.is_empty() {
                    let selected = self.logs_state.selected().unwrap_or(0);
                    if selected < self.logs.len() - 1 {
                        self.logs_state.select(Some(selected + 1));
                    }
                }
            }
            KeyCode::Char('k') | KeyCode::Up => {
                // Scroll up
                if let Some(selected) = self.logs_state.selected() {
                    if selected > 0 {
                        self.logs_state.select(Some(selected - 1));
                    }
                }
            }
            _ => {}
        }
    }

    /// Handle modal overlay keys
    fn handle_modal_key(&mut self, key: KeyCode) {
        // Special handling for ModuleInput modal - needs character input
        if let ModalState::ModuleInput {
            module_id,
            module_name,
            inputs,
            current_input_index,
            collected_values,
            buffer,
            error_message: _,
        } = &mut self.modal
        {
            match key {
                KeyCode::Char(c) => {
                    buffer.push(c);
                }
                KeyCode::Backspace => {
                    buffer.pop();
                }
                KeyCode::Enter => {
                    // Validate and advance to next input or execute
                    if let Some(input) = inputs.get(*current_input_index) {
                        // Basic validation
                        let is_valid = if input.required && buffer.trim().is_empty() {
                            false
                        } else {
                            true
                        };

                        if !is_valid {
                            // Update error message in place
                            self.modal = ModalState::ModuleInput {
                                module_id: module_id.clone(),
                                module_name: module_name.clone(),
                                inputs: inputs.clone(),
                                current_input_index: *current_input_index,
                                collected_values: collected_values.clone(),
                                buffer: buffer.clone(),
                                error_message: Some("This field is required".to_string()),
                            };
                            return;
                        }

                        // Store the value
                        collected_values.insert(input.name.clone(), buffer.clone());

                        // Check if this was the last input
                        if *current_input_index + 1 >= inputs.len() {
                            // All inputs collected - execute module
                            // Construct args in CLI flag format: ["--user", "value", "--manager", "value"]
                            let mut args: Vec<String> = Vec::new();
                            for inp in inputs.iter() {
                                if let Some(value) = collected_values.get(&inp.name) {
                                    // Convert input name to kebab-case flag (e.g., "device_action" -> "--device-action")
                                    let flag_name = format!("--{}", inp.name.replace('_', "-"));
                                    args.push(flag_name);
                                    args.push(value.clone());
                                }
                            }

                            let module_id_clone = module_id.clone();
                            self.modal = ModalState::None;
                            self.execute_module(module_id_clone, args);
                        } else {
                            // Advance to next input
                            self.modal = ModalState::ModuleInput {
                                module_id: module_id.clone(),
                                module_name: module_name.clone(),
                                inputs: inputs.clone(),
                                current_input_index: *current_input_index + 1,
                                collected_values: collected_values.clone(),
                                buffer: String::new(),
                                error_message: None,
                            };
                        }
                    }
                }
                KeyCode::Esc => {
                    self.modal = ModalState::None;
                }
                _ => {}
            }
            return;
        }

        // Handle ExecutionProgress modal
        if matches!(self.modal, ModalState::ExecutionProgress { .. }) {
            match key {
                KeyCode::Esc => {
                    // Close execution modal and show summary
                    self.modal = ModalState::None;
                }
                _ => {}
            }
            return;
        }

        // Handle ModuleDetail modal for Settings authentication - 'l' to login
        if let ModalState::ModuleDetail(ref module_id) = self.modal {
            if module_id == "settings:authentication" && key == KeyCode::Char('l') {
                self.initiate_login(None); // Use "common" tenant by default
                return;
            }
        }

        // Handle LoginFlow modal
        if let ModalState::LoginFlow { stage, .. } = &self.modal {
            match key {
                KeyCode::Esc => {
                    // Cancel login flow
                    self.modal = ModalState::None;
                    self.add_log("Login cancelled".to_string());
                }
                KeyCode::Enter if matches!(stage, LoginStage::Success) => {
                    // Close success modal
                    self.modal = ModalState::None;
                }
                KeyCode::Enter if matches!(stage, LoginStage::Failed) => {
                    // Close failure modal
                    self.modal = ModalState::None;
                }
                _ => {}
            }
            return;
        }

        // Standard modal handling
        match key {
            KeyCode::Esc => {
                self.modal = ModalState::None;
                self.input_buffer.clear();
            }
            KeyCode::Enter => {
                // Handle modal confirmation
                match &self.modal {
                    ModalState::Confirm(ConfirmAction::ClearTaskHistory) => {
                        self.task_output = None;
                        self.add_log("Task history cleared".to_string());
                        self.modal = ModalState::None;
                    }
                    ModalState::Confirm(ConfirmAction::ClearTokenCache) => {
                        if let Err(e) = self.clear_token_cache() {
                            self.add_log(format!("Failed to clear token cache: {}", e));
                        } else {
                            self.add_log("Token cache cleared - please re-authenticate".to_string());
                            self.auth_status = AuthStatus::Unknown;
                            self.user_profile = None;
                            self.token_expires_at = None;
                            self.token_expiry_countdown = None;
                        }
                        self.modal = ModalState::None;
                    }
                    ModalState::Confirm(ConfirmAction::DisableAllModules) => {
                        // Disable all modules
                        let registry = crate::modules::MODULE_REGISTRY.lock().unwrap();
                        let all_module_ids: Vec<String> = registry.config.modules
                            .iter()
                            .map(|m| m.id.clone())
                            .collect();
                        drop(registry);

                        self.config.disable_all(&all_module_ids);

                        self.add_log(format!("Disabled {} modules", all_module_ids.len()));
                        self.modal = ModalState::None;
                    }
                    _ => {
                        self.modal = ModalState::None;
                    }
                }
            }
            _ => {}
        }
    }

    /// Get filtered task result rows
    #[allow(dead_code)] // Will be used in results table rendering
    pub fn get_filtered_rows(&self) -> Vec<Vec<String>> {
        if let Some(ref output) = self.task_output {
            if self.filter_buffer.is_empty() {
                return output.rows.clone();
            }

            let filter_lower = self.filter_buffer.to_lowercase();
            output.rows.iter()
                .filter(|row| {
                    row.iter().any(|cell| cell.to_lowercase().contains(&filter_lower))
                })
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Export current configuration to a timestamped JSON file
    fn export_configuration(&mut self) -> anyhow::Result<()> {
        use std::fs;
        use chrono::Local;

        // Create config directory if it doesn't exist
        let config_dir = std::env::current_dir()?.join("config_exports");
        fs::create_dir_all(&config_dir)?;

        // Generate timestamped filename
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        let filename = format!("config_export_{}.json", timestamp);
        let filepath = config_dir.join(&filename);

        // Serialize configuration to JSON
        let json = serde_json::to_string_pretty(&self.config)?;

        // Write to file
        fs::write(&filepath, json)?;

        self.add_log(format!("Configuration exported to: {}", filepath.display()));

        Ok(())
    }

    /// Clear token cache by deleting from OS keyring
    fn clear_token_cache(&self) -> anyhow::Result<()> {
        use keyring::Entry;

        // Clear refresh token from keyring
        let entry = Entry::new("o365-cli", "refresh_token")
            .map_err(|e| anyhow::anyhow!("Failed to access keyring: {}", e))?;

        entry.delete_credential()
            .map_err(|e| anyhow::anyhow!("Failed to delete token: {}", e))?;

        Ok(())
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
