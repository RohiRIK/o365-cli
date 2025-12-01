use crate::runner;
use crate::auth::AuthManager;
use anyhow::Result;
use inquire::{Select, Text, Confirm};

pub async fn start() -> Result<()> {
    println!("👋 Welcome to the Admin CLI");

    loop {
        let choices = vec![
            "🔐 Login / Re-authenticate",
            "🛡️  Security Governance",
            "👤 IAM & User Management",
            "🚪 Exit",
        ];

        let choice = Select::new("What would you like to do?", choices).prompt()?;

        match choice {
            "🔐 Login / Re-authenticate" => {
                let tenant = Text::new("Tenant ID (Optional, press Enter for common):")
                    .with_default("common")
                    .prompt()?;
                let auth = AuthManager::new(&tenant)?;
                let _ = auth.login().await?;
            },
            "🛡️  Security Governance" => {
                handle_security_menu().await?;
            },
            "👤 IAM & User Management" => {
                handle_iam_menu().await?;
            },
            "🚪 Exit" => {
                println!("Bye! 👋");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

async fn handle_security_menu() -> Result<()> {
    let choices = vec![
        "🕵️  Shadow IT Audit (Dry Run)",
        "🕵️  Shadow IT Remediation (REVOKE)",
        "⬅️  Back",
    ];

    let choice = Select::new("Security Modules:", choices).prompt()?;

    match choice {
        "🕵️  Shadow IT Audit (Dry Run)" => {
            run_module("sec:shadow-it", &[]).await?;
        },
        "🕵️  Shadow IT Remediation (REVOKE)" => {
            let confirm = Confirm::new("⚠️  This will REVOKE permissions for risky apps. Are you sure?")
                .with_default(false)
                .prompt()?;
            
            if confirm {
                run_module("sec:shadow-it", &["--dry-run", "false"]).await?;
            }
        },
        _ => {}
    }
    Ok(())
}

async fn handle_iam_menu() -> Result<()> {
    let choices = vec![
        "👋 Graceful Offboarding",
        "🧪 Test Connectivity (Who am I?)",
        "⬅️  Back",
    ];

    let choice = Select::new("IAM Modules:", choices).prompt()?;

    match choice {
        "👋 Graceful Offboarding" => {
            let email = Text::new("Target User Email:").prompt()?;
            if !email.trim().is_empty() {
                run_module("iam:offboard", &["--user", &email]).await?;
            }
        },
        "🧪 Test Connectivity (Who am I?)" => {
            run_module("iam:test", &[]).await?;
        },
        _ => {}
    }
    Ok(())
}

async fn run_module(task: &str, args: &[&str]) -> Result<()> {
    println!("🔑 Verifying session...");
    // Always use common for running tasks unless specific tenant logic is added
    let auth = AuthManager::new("common")?;
    let token = auth.get_access_token().await?;
    
    let args_vec: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    runner::run_task(task, &args_vec, &token)?;
    
    // Pause so user can read output before menu clears screen
    println!("\n(Press Enter to continue)");
    let _ = std::io::stdin().read_line(&mut String::new());
    
    Ok(())
}
