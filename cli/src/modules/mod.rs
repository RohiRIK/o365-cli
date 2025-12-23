use crate::app::App;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

/// Core trait that all modules must implement
/// This replaces the hardcoded CurrentTab enum with a dynamic, extensible system
pub trait Module: Send + Sync {
    /// Unique identifier for routing (e.g., "iam:offboard", "sec:shadow-it")
    /// Must match the task_id in TypeScript TaskRegistry
    fn id(&self) -> &str;

    /// Display name shown in TUI menu (e.g., "Graceful Offboarding")
    fn display_name(&self) -> &str;

    /// Category for tab grouping
    fn category(&self) -> ModuleCategory;

    /// Description shown in help text and module details
    fn description(&self) -> &str;

    /// Required Graph API permissions (for documentation and validation)
    fn required_permissions(&self) -> Vec<&str>;

    /// Handle user input flow - returns TaskExecution when ready to execute
    /// Each module manages its own input state machine
    /// Returns None if still collecting input, Some(TaskExecution) when ready
    fn handle_input(&mut self, app: &mut App) -> Option<TaskExecution>;

    /// Whether this module supports dry-run mode
    fn supports_dry_run(&self) -> bool {
        true
    }

    /// Priority for menu ordering (higher = appears first in list)
    /// Range: 0-255, default 50
    fn priority(&self) -> u8 {
        50
    }

    /// Whether this module is currently implemented (vs planned)
    fn is_implemented(&self) -> bool {
        true
    }

    /// Reset module state (called when switching tabs or after execution)
    fn reset(&mut self) {
        // Default: no-op, override if module has stateful input flows
    }
}

/// Module category for tab grouping
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModuleCategory {
    IAM,
    Security,
    Governance,
    Resources,
    Reporting,
    Settings, // Special category for system settings
}

impl ModuleCategory {
    pub fn to_string(&self) -> &str {
        match self {
            ModuleCategory::IAM => "IAM",
            ModuleCategory::Security => "Security",
            ModuleCategory::Governance => "Governance",
            ModuleCategory::Resources => "Resources",
            ModuleCategory::Reporting => "Reporting",
            ModuleCategory::Settings => "Settings",
        }
    }

    pub fn from_string(s: &str) -> Option<Self> {
        match s {
            "IAM" => Some(ModuleCategory::IAM),
            "Security" => Some(ModuleCategory::Security),
            "Governance" => Some(ModuleCategory::Governance),
            "Resources" => Some(ModuleCategory::Resources),
            "Reporting" => Some(ModuleCategory::Reporting),
            "Settings" => Some(ModuleCategory::Settings),
            _ => None,
        }
    }
}

/// Task execution request returned by module's handle_input()
#[derive(Debug, Clone)]
pub struct TaskExecution {
    pub task_name: String,
    pub args: Vec<String>,
}

impl TaskExecution {
    pub fn new(task_name: impl Into<String>, args: Vec<String>) -> Self {
        Self {
            task_name: task_name.into(),
            args,
        }
    }
}

/// Configuration schema for modules.toml
#[derive(Debug, Clone, Deserialize)]
pub struct ModuleConfig {
    pub system: SystemConfig,
    pub modules: Vec<ModuleDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SystemConfig {
    pub max_concurrent_workers: usize,
    pub default_dry_run: bool,
    pub ipc_version: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModuleDefinition {
    pub id: String,
    pub display_name: String,
    pub category: String,
    pub description: String,
    pub priority: u8,
    pub permissions: Vec<String>,
    pub supported: bool,
    pub inputs: Vec<InputDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InputDefinition {
    pub name: String,
    #[serde(rename = "type")]
    pub input_type: String,
    pub prompt: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub optional: bool,
    pub default: Option<toml::Value>,
    pub choices: Option<Vec<String>>,
    pub min: Option<i64>,
    pub max: Option<i64>,
}

impl ModuleConfig {
    /// Load module configuration from modules.toml
    pub fn load<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let content = fs::read_to_string(path)?;
        let config: ModuleConfig = toml::from_str(&content)?;
        Ok(config)
    }

    /// Get all modules for a specific category, sorted by priority (descending)
    pub fn modules_by_category(&self, category: ModuleCategory) -> Vec<&ModuleDefinition> {
        let category_str = category.to_string();
        let mut modules: Vec<&ModuleDefinition> = self
            .modules
            .iter()
            .filter(|m| m.category == category_str)
            .collect();
        modules.sort_by(|a, b| b.priority.cmp(&a.priority));
        modules
    }

    /// Get a specific module by ID
    pub fn get_module(&self, id: &str) -> Option<&ModuleDefinition> {
        self.modules.iter().find(|m| m.id == id)
    }
}

/// Global module registry - lazily initialized from modules.toml
/// This replaces the hardcoded module lists in app.rs
pub static MODULE_REGISTRY: Lazy<Mutex<ModuleRegistry>> = Lazy::new(|| {
    let registry = ModuleRegistry::new();
    Mutex::new(registry)
});

/// Module registry that loads configuration and manages module instances
pub struct ModuleRegistry {
    pub config: ModuleConfig,
    modules: HashMap<String, Box<dyn Module>>,
}

impl ModuleRegistry {
    /// Create new registry by loading modules.toml
    pub fn new() -> Self {
        let config = ModuleConfig::load("../modules.toml")
            .unwrap_or_else(|e| panic!("Failed to load modules.toml: {}", e));

        Self {
            config,
            modules: HashMap::new(),
        }
    }

    /// Register a module instance
    pub fn register(&mut self, module: Box<dyn Module>) {
        let id = module.id().to_string();
        self.modules.insert(id, module);
    }

    /// Get a module by ID
    pub fn get(&self, id: &str) -> Option<&Box<dyn Module>> {
        self.modules.get(id)
    }

    /// Get a mutable reference to a module by ID
    pub fn get_mut(&mut self, id: &str) -> Option<&mut Box<dyn Module>> {
        self.modules.get_mut(id)
    }

    /// Get all modules for a specific category, sorted by priority
    pub fn modules_by_category(&self, category: ModuleCategory) -> Vec<&ModuleDefinition> {
        self.config.modules_by_category(category)
    }

    /// Get all registered module instances
    pub fn all_modules(&self) -> Vec<&Box<dyn Module>> {
        self.modules.values().collect()
    }

    /// Get system configuration
    pub fn system_config(&self) -> &SystemConfig {
        &self.config.system
    }
}

/// Helper functions for module operations
pub mod helpers {
    use super::*;

    /// Get modules for a category from the registry
    pub fn get_modules_by_category(category: ModuleCategory) -> Vec<ModuleDefinition> {
        let registry = MODULE_REGISTRY.lock().unwrap();
        registry
            .modules_by_category(category)
            .into_iter()
            .cloned()
            .collect()
    }

    /// Get module count by category
    pub fn module_count_by_category(category: ModuleCategory) -> usize {
        let registry = MODULE_REGISTRY.lock().unwrap();
        registry.modules_by_category(category).len()
    }

    /// Get total module count
    pub fn total_module_count() -> usize {
        let registry = MODULE_REGISTRY.lock().unwrap();
        registry.config.modules.len()
    }

    /// Get implemented module count
    pub fn implemented_module_count() -> usize {
        let registry = MODULE_REGISTRY.lock().unwrap();
        registry.config.modules.iter().filter(|m| m.supported).count()
    }

    /// Check if a module is supported/implemented
    pub fn is_module_supported(id: &str) -> bool {
        let registry = MODULE_REGISTRY.lock().unwrap();
        registry
            .config
            .get_module(id)
            .map(|m| m.supported)
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_config_loading() {
        let config = ModuleConfig::load("../modules.toml").expect("Failed to load modules.toml");

        // Should have 29 modules total (expanded catalog)
        assert_eq!(config.modules.len(), 29);

        // Check system config
        assert_eq!(config.system.max_concurrent_workers, 3);
        assert_eq!(config.system.default_dry_run, true);
        assert_eq!(config.system.ipc_version, "1.0");
    }

    #[test]
    fn test_module_definition_lookup() {
        let config = ModuleConfig::load("../modules.toml").expect("Failed to load modules.toml");

        // Test offboarding module
        let offboard = config
            .get_module("iam:offboard")
            .expect("Offboarding module not found");

        assert_eq!(offboard.display_name, "Graceful Offboarding");
        assert_eq!(offboard.category, "IAM");
        assert_eq!(offboard.priority, 100);
        assert!(offboard.supported);
        assert!(offboard.permissions.contains(&"User.ReadWrite.All".to_string()));
    }

    #[test]
    fn test_modules_by_category() {
        let config = ModuleConfig::load("../modules.toml").expect("Failed to load modules.toml");

        // IAM should have 3 modules
        let iam_modules = config.modules_by_category(ModuleCategory::IAM);
        assert_eq!(iam_modules.len(), 3);

        // Security should have 10 modules (MFA, risky sign-ins, privileged access, conditional access, BitLocker, Shadow IT, etc.)
        let sec_modules = config.modules_by_category(ModuleCategory::Security);
        assert_eq!(sec_modules.len(), 10);

        // Governance should have 4 modules (GDPR, retention, DLP, audit logs)
        let gov_modules = config.modules_by_category(ModuleCategory::Governance);
        assert_eq!(gov_modules.len(), 4);

        // Resources should have 10 modules (device mgmt, cost optimization, collaboration)
        let res_modules = config.modules_by_category(ModuleCategory::Resources);
        assert_eq!(res_modules.len(), 10);

        // Reporting should have 2 modules (user analyzer, teams sprawl)
        let rep_modules = config.modules_by_category(ModuleCategory::Reporting);
        assert_eq!(rep_modules.len(), 2);
    }

    #[test]
    fn test_module_priority_sorting() {
        let config = ModuleConfig::load("../modules.toml").expect("Failed to load modules.toml");

        let iam_modules = config.modules_by_category(ModuleCategory::IAM);

        // Should be sorted by priority descending
        // iam:offboard (100) > iam:guest-cleanup (90) > iam:onboard (85)
        assert_eq!(iam_modules[0].id, "iam:offboard");
        assert_eq!(iam_modules[1].id, "iam:guest-cleanup");
        assert_eq!(iam_modules[2].id, "iam:onboard");
    }

    #[test]
    fn test_input_definitions() {
        let config = ModuleConfig::load("../modules.toml").expect("Failed to load modules.toml");

        let offboard = config.get_module("iam:offboard").unwrap();

        // Should have 3 inputs
        assert_eq!(offboard.inputs.len(), 3);

        // Check user input
        let user_input = &offboard.inputs[0];
        assert_eq!(user_input.name, "user");
        assert_eq!(user_input.input_type, "email");
        assert!(user_input.required);

        // Check device_action input
        let device_input = &offboard.inputs[2];
        assert_eq!(device_input.name, "device_action");
        assert_eq!(device_input.input_type, "choice");
        assert!(device_input.choices.is_some());
        let choices = device_input.choices.as_ref().unwrap();
        assert_eq!(choices, &vec!["retire", "wipe", "none"]);
    }

    #[test]
    fn test_helper_functions() {
        let iam_modules = helpers::get_modules_by_category(ModuleCategory::IAM);
        assert_eq!(iam_modules.len(), 3);

        let total = helpers::total_module_count();
        assert_eq!(total, 29); // Expanded catalog with device mgmt, compliance, advanced security, cost optimization

        let implemented = helpers::implemented_module_count();
        assert_eq!(implemented, 3); // Currently: offboard, guest-cleanup, shadow-it (others marked as supported=false)

        assert!(helpers::is_module_supported("iam:offboard"));
        assert!(helpers::is_module_supported("sec:shadow-it"));
        assert!(!helpers::is_module_supported("iam:onboard")); // Not yet implemented
    }
}
