// Configuration management module
// Handles loading/saving user preferences to ~/.o365-cli/config.toml

pub mod loader;
pub mod defaults;
pub mod schema;

// Re-export main types
pub use defaults::default_config;
pub use schema::validate_config;
