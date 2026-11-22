use crate::state::ConfigState;

/// Create default configuration
#[allow(dead_code)] // Will be used for config persistence
pub fn default_config() -> ConfigState {
    ConfigState::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = default_config();

        // Verify defaults
        assert_eq!(config.appearance.compact_mode, false);
        assert_eq!(config.appearance.show_descriptions, true);
        assert_eq!(config.execution.concurrency_limit, 3);
        assert_eq!(config.execution.retry_attempts, 3);
        assert_eq!(config.execution.default_dry_run, true);
        assert!(config.modules.enabled_modules.is_empty());
    }
}
