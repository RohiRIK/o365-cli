use crate::state::LoginStage;
use std::sync::mpsc::{Sender, Receiver};
use std::thread;
use anyhow::Result;

/// Messages sent from login handler thread to main TUI thread
#[derive(Debug, Clone)]
pub enum LoginUpdate {
    Stage {
        stage: LoginStage,
        auth_url: Option<String>,
        message: String,
        error: Option<String>,
    },
    Success {
        tenant_id: String,
        user_principal: String,
    },
    Failed {
        error: String,
    },
}

/// Spawns background thread to handle OAuth login flow
pub fn spawn_login_handler(tenant: String) -> Receiver<LoginUpdate> {
    let (tx, rx) = std::sync::mpsc::channel();

    thread::spawn(move || {
        if let Err(e) = run_login_flow(tx.clone(), &tenant) {
            let _ = tx.send(LoginUpdate::Failed {
                error: format!("Login failed: {}", e),
            });
        }
    });

    rx
}

/// Runs the complete OAuth PKCE login flow
fn run_login_flow(tx: Sender<LoginUpdate>, tenant: &str) -> Result<()> {
    // Create tokio runtime for async operations
    let rt = tokio::runtime::Runtime::new()?;

    rt.block_on(async {
        // Send initializing stage
        let _ = tx.send(LoginUpdate::Stage {
            stage: LoginStage::Initializing,
            auth_url: None,
            message: "Preparing login...".to_string(),
            error: None,
        });

        // Create auth manager
        let auth = crate::auth::AuthManager::new(tenant)?;

        // Send waiting for browser stage
        let _ = tx.send(LoginUpdate::Stage {
            stage: LoginStage::WaitingForBrowser,
            auth_url: None,
            message: "Opening browser for authentication...".to_string(),
            error: None,
        });

        // Send polling for token stage
        let _ = tx.send(LoginUpdate::Stage {
            stage: LoginStage::PollingForToken,
            auth_url: None,
            message: "Waiting for authorization...".to_string(),
            error: None,
        });

        // Run the login flow (opens browser, waits for callback, exchanges code)
        let _ = auth.login().await?;

        // Load the profile that was saved by login()
        let profile = crate::profile::UserProfile::load()
            .ok_or_else(|| anyhow::anyhow!("Failed to load profile after login"))?;

        // Send success
        let _ = tx.send(LoginUpdate::Success {
            tenant_id: profile.tenant_id.clone(),
            user_principal: profile.email.clone(),
        });

        Ok(())
    })
}
