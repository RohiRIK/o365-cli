mod app;
mod auth;
mod profile;
mod runner;
mod tui;
mod ui;

use anyhow::Result;
use auth::AuthManager;
use clap::{Parser, Subcommand};
use simplelog::*;
use std::fs::File;

#[derive(Parser)]
#[command(name = "o365-cli")]
#[command(about = "Office 365 Administration Toolset", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Authenticate with Microsoft Entra ID
    Login {
        /// Optional: The Tenant ID to sign into (defaults to "common")
        #[arg(long, default_value = "common")]
        tenant: String,
    },
    /// Run a specific task
    Run {
        /// The command/module to run (e.g., iam:offboard)
        task: String,

        /// Arguments to pass to the task
        #[arg(last = true)]
        args: Vec<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize File Logger
    CombinedLogger::init(
        vec![
            WriteLogger::new(
                LevelFilter::Info,
                Config::default(),
                File::create("o365-cli.log").unwrap(),
            ),
        ]
    ).unwrap();

    log::info!("Starting o365-cli...");

    // Check if arguments were provided
    if std::env::args().len() <= 1 {
        // No args? Launch TUI!
        let mut terminal = tui::init()?;
        let app = app::App::new();
        let res = tui::run_app(&mut terminal, app).await;
        tui::restore()?;
        
        if let Err(err) = res {
            println!("Error running TUI: {:?}", err);
        }
        return Ok(());
    }

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Login { tenant }) => {
             let auth = AuthManager::new(&tenant)?;
             let _ = auth.login().await?;
        }
        Some(Commands::Run { task, args }) => {
            println!("🔑 Verifying session...");
            
            // Load profile to get tenant ID
            let profile = profile::UserProfile::load();
            let tenant = profile
                .as_ref()
                .map(|p| p.tenant_id.as_str())
                .unwrap_or("common");
            
            let auth = AuthManager::new(tenant)?;
            let token = auth.get_access_token().await?;
            
            let _output = runner::run_task(&task, &args, &token, |msg| println!("{}", msg))?;
        }
        None => {
            // Should be unreachable due to the check at start, but safe fallback
            let mut terminal = tui::init()?;
            let app = app::App::new();
            let res = tui::run_app(&mut terminal, app).await;
            tui::restore()?;
            res?;
        }
    }

    Ok(())
}
