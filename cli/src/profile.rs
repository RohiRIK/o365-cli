use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub name: String,
    pub email: String,
    pub tenant_id: String,
    pub scopes: Vec<String>,
    pub last_login: String,
}

impl UserProfile {
    fn get_path() -> Result<PathBuf> {
        let current_dir = std::env::current_dir()?;
        // Handle running from project root or inside cli/
        let root_dir = if current_dir.ends_with("cli") {
            current_dir
        } else {
            current_dir.join("cli")
        };
        Ok(root_dir.join(".o365_cli_profile.json"))
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::get_path()?;
        let json = serde_json::to_string_pretty(self)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn load() -> Option<Self> {
        let path = Self::get_path().ok()?;
        if path.exists() {
            let content = fs::read_to_string(path).ok()?;
            serde_json::from_str(&content).ok()
        } else {
            None
        }
    }
}
