use crate::state::ConfigState;
use anyhow::{Result, Context};
use std::fs;
use std::path::PathBuf;

/// Get the path to the config file (~/.o365-cli/config.toml)
#[allow(dead_code)] // Will be used for config persistence
pub fn get_config_path() -> Result<PathBuf> {
    let home = dirs::home_dir()
        .context("Failed to determine home directory")?;

    let config_dir = home.join(".o365-cli");
    fs::create_dir_all(&config_dir)
        .context("Failed to create .o365-cli directory")?;

    Ok(config_dir.join("config.toml"))
}

/// Load configuration from file, or create default if not exists
#[allow(dead_code)] // Will be used for config persistence
pub fn load_config() -> Result<ConfigState> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        // No config file exists, create default
        let default_config = crate::config::default_config();
        save_config(&default_config)?;
        return Ok(default_config);
    }

    // Read existing config file
    let contents = fs::read_to_string(&config_path)
        .context("Failed to read config file")?;

    // Parse TOML
    let config: ConfigState = toml::from_str(&contents)
        .context("Failed to parse config file")?;

    // Validate
    crate::config::validate_config(&config)?;

    Ok(config)
}

/// Save configuration to file
#[allow(dead_code)] // Will be used for config persistence
pub fn save_config(config: &ConfigState) -> Result<()> {
    // Validate before saving
    crate::config::validate_config(config)?;

    let config_path = get_config_path()?;

    // Serialize to TOML
    let toml_string = toml::to_string_pretty(config)
        .context("Failed to serialize config to TOML")?;

    // Write to file
    fs::write(&config_path, toml_string)
        .context("Failed to write config file")?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_path() {
        let path = get_config_path().unwrap();
        assert!(path.to_string_lossy().contains(".o365-cli"));
        assert!(path.to_string_lossy().ends_with("config.toml"));
    }

    #[test]
    fn test_save_and_load() {
        let mut config = crate::config::default_config();
        config.execution.concurrency_limit = 5;

        // Save
        save_config(&config).unwrap();

        // Load
        let loaded = load_config().unwrap();
        assert_eq!(loaded.execution.concurrency_limit, 5);
    }
}
