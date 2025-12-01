mod auth;
mod runner;
mod interactive;

use anyhow::Result;
use clap::{Parser, Subcommand};
use auth::AuthManager;

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
    // Check if arguments were provided
    if std::env::args().len() <= 1 {
        // No args? Interactive mode!
        return interactive::start().await;
    }

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Login { tenant }) => {
             let auth = AuthManager::new(&tenant)?;
             let _ = auth.login().await?;
        }
        Some(Commands::Run { task, args }) => {
            println!("🔑 Verifying session...");
            let auth = AuthManager::new("common")?;
            let token = auth.get_access_token().await?;
            
            runner::run_task(&task, &args, &token)?;
        }
        None => {
            // Should be unreachable due to the check at start, but safe fallback
            interactive::start().await?;
        }
    }

    Ok(())
}
