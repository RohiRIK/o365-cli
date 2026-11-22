use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// User configuration state (persisted to ~/.o365-cli/config.toml)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigState {
    pub appearance: AppearanceConfig,
    pub execution: ExecutionConfig,
    pub modules: ModuleConfig,
}

/// Appearance settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceConfig {
    pub compact_mode: bool,
    pub show_descriptions: bool,
}

/// Execution settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionConfig {
    pub concurrency_limit: usize,
    pub retry_attempts: usize,
    pub default_dry_run: bool,
}

/// Module enable/disable state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleConfig {
    #[serde(default)]
    pub enabled_modules: HashMap<String, bool>,
}

impl ConfigState {
    /// Create default configuration
    pub fn default() -> Self {
        Self {
            appearance: AppearanceConfig::default(),
            execution: ExecutionConfig::default(),
            modules: ModuleConfig::default(),
        }
    }

    /// Check if a module is enabled
    pub fn is_module_enabled(&self, module_id: &str) -> bool {
        self.modules.enabled_modules.get(module_id).copied().unwrap_or(false)
    }

    /// Toggle module enable/disable state
    pub fn toggle_module(&mut self, module_id: &str) {
        let current = self.is_module_enabled(module_id);
        self.modules.enabled_modules.insert(module_id.to_string(), !current);
    }

    /// Enable a specific module
    #[allow(dead_code)] // Scaffolding for future batch enable operations
    pub fn enable_module(&mut self, module_id: &str) {
        self.modules.enabled_modules.insert(module_id.to_string(), true);
    }

    /// Disable a specific module
    #[allow(dead_code)] // Scaffolding for future batch disable operations
    pub fn disable_module(&mut self, module_id: &str) {
        self.modules.enabled_modules.insert(module_id.to_string(), false);
    }

    /// Enable all modules
    pub fn enable_all(&mut self) {
        self.modules.enabled_modules.clear();
    }

    /// Disable all modules
    pub fn disable_all(&mut self, all_module_ids: &[String]) {
        for id in all_module_ids {
            self.modules.enabled_modules.insert(id.clone(), false);
        }
    }
}

impl Default for AppearanceConfig {
    fn default() -> Self {
        Self {
            compact_mode: false,
            show_descriptions: true,
        }
    }
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        Self {
            concurrency_limit: 3,
            retry_attempts: 3,
            default_dry_run: true,
        }
    }
}

impl Default for ModuleConfig {
    fn default() -> Self {
        Self {
            enabled_modules: HashMap::new(),
        }
    }
}
