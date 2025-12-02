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
use std::fs::{File, create_dir_all};
use chrono::Local;

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
    // Create logs directory if it doesn't exist
    let logs_dir = std::env::current_dir()
        .unwrap()
        .join("logs");
    
    create_dir_all(&logs_dir).expect("Failed to create logs directory");
    
    // Create session-based log file with timestamp
    let timestamp = Local::now().format("%Y%m%d_%H%M%S");
    let log_filename = format!("o365-cli_{}.log", timestamp);
    let log_path = logs_dir.join(&log_filename);
    
    let log_config = ConfigBuilder::new()
        .set_time_format_rfc3339()
        .set_thread_level(LevelFilter::Error)
        .set_target_level(LevelFilter::Error)
        .build();
    
    CombinedLogger::init(
        vec![
            WriteLogger::new(
                LevelFilter::Debug,
                log_config,
                File::create(&log_path).expect("Failed to create log file"),
            ),
        ]
    ).expect("Failed to initialize logger");

    log::info!("=================================");
    log::info!("Starting o365-cli v{}", env!("CARGO_PKG_VERSION"));
    log::info!("Session ID: {}", timestamp);
    log::info!("Log file: {}", log_path.display());
    log::info!("=================================");

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
