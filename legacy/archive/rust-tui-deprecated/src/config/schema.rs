use crate::state::ConfigState;
use anyhow::{Result, bail};

/// Validate configuration values are within acceptable ranges
#[allow(dead_code)] // Will be used for config persistence
pub fn validate_config(config: &ConfigState) -> Result<()> {
    // Validate concurrency limit
    if config.execution.concurrency_limit == 0 {
        bail!("concurrency_limit must be at least 1");
    }
    if config.execution.concurrency_limit > 10 {
        bail!("concurrency_limit cannot exceed 10 (recommended max)");
    }

    // Validate retry attempts
    if config.execution.retry_attempts == 0 {
        bail!("retry_attempts must be at least 1");
    }
    if config.execution.retry_attempts > 10 {
        bail!("retry_attempts cannot exceed 10");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_config() {
        let config = ConfigState::default();
        assert!(validate_config(&config).is_ok());
    }

    #[test]
    fn test_invalid_concurrency() {
        let mut config = ConfigState::default();
        config.execution.concurrency_limit = 0;
        assert!(validate_config(&config).is_err());

        config.execution.concurrency_limit = 11;
        assert!(validate_config(&config).is_err());
    }

    #[test]
    fn test_invalid_retry() {
        let mut config = ConfigState::default();
        config.execution.retry_attempts = 0;
        assert!(validate_config(&config).is_err());

        config.execution.retry_attempts = 11;
        assert!(validate_config(&config).is_err());
    }
}
