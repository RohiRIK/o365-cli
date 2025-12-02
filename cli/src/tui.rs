use crossterm::{
    event::{self, Event},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::Backend, Terminal};
use ratatui::prelude::CrosstermBackend; // Correct import for CrosstermBackend
use std::{io::{self, Stdout}, time::{Duration, Instant}, fs};
use crate::auth::AuthManager;
use crate::profile::UserProfile;
use serde::Deserialize;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use chrono::DateTime;

// Define a type alias for the Terminal
pub type Tui = Terminal<CrosstermBackend<Stdout>>;

#[derive(Debug, Deserialize)]
struct Claims {
    name: Option<String>,
    preferred_username: Option<String>,
    upn: Option<String>,
    tid: Option<String>,
    iat: Option<i64>,
    scp: Option<String>,
}

pub fn init() -> Result<Tui, anyhow::Error> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout); // Use the imported CrosstermBackend
    let terminal = Terminal::new(backend)?;
    Ok(terminal)
}

pub fn restore() -> Result<(), anyhow::Error> {
    disable_raw_mode()?;
    execute!(io::stdout(), LeaveAlternateScreen)?;
    Ok(())
}

pub async fn run_app<B: Backend>(terminal: &mut Terminal<B>, mut app: crate::app::App) -> Result<(), anyhow::Error> {
    // Initial Session Check
    if app.user_profile.is_some() {
        app.add_log("🔄 Verifying Session...".to_string());
        app.auth_status = crate::app::AuthStatus::Checking;
        terminal.draw(|f| crate::ui::render(f, &mut app))?;
        
        // Use the tenant from the profile if possible, otherwise common
        let tenant = app.user_profile.as_ref().map(|p| p.tenant_id.as_str()).unwrap_or("common");
        let auth = AuthManager::new(tenant)?;
        
        match auth.get_access_token().await {
            Ok(_) => {
                app.auth_status = crate::app::AuthStatus::Valid("Active".to_string());
                app.add_log("✅ Session Verified".to_string());
            },
            Err(e) => {
                app.auth_status = crate::app::AuthStatus::Invalid(e.to_string());
                app.user_profile = None; // Invalidate
                app.add_log(format!("⚠️ Session Expired: {}", e));
            }
        }
    }

    let tick_rate = Duration::from_millis(250);
    let mut last_tick = Instant::now();
    loop {
        terminal.draw(|f| crate::ui::render(f, &mut app))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        if crossterm::event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                let action = app.on_key(key.code);
                match action {
                    Some(crate::app::AppAction::Login) => {
                        // Start Login Flow with tenant from profile or default to common
                        app.is_loading = true;
                        let tenant_to_use = if app.tenant_id == "Not Connected" || app.tenant_id.is_empty() {
                            "common".to_string()
                        } else {
                            app.tenant_id.clone()
                        };
                        app.add_log(format!("🚀 Authenticating with tenant: {}...", tenant_to_use));
                        terminal.draw(|f| crate::ui::render(f, &mut app))?; // Force redraw to show loading

                        let auth = AuthManager::new(&tenant_to_use)?;
                        match auth.login().await {
                            Ok(token) => {
                                app.add_log("✅ Login Successful!".to_string());
                                
                                // Decode the token (without validation for display purposes)
                                let mut validation = Validation::new(Algorithm::RS256);
                                validation.insecure_disable_signature_validation();
                                validation.validate_aud = false;
                                validation.validate_exp = false;
                                validation.validate_nbf = false;
                                
                                match decode::<Claims>(&token, &DecodingKey::from_secret(&[]), &validation) {
                                    Ok(token_data) => {
                                        let claims = token_data.claims;
                                        let name = claims.name.unwrap_or("Unknown User".to_string());
                                        let email = claims.preferred_username.or(claims.upn).unwrap_or("No Email".to_string());
                                        let tenant = claims.tid.unwrap_or("Unknown Tenant".to_string());
                                        let scopes = claims.scp.unwrap_or_default().split_whitespace().map(String::from).collect();
                                        
                                        let last_login = if let Some(iat) = claims.iat {
                                             match DateTime::from_timestamp(iat, 0) {
                                                 Some(dt) => dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
                                                 None => "Invalid Date".to_string(),
                                             }
                                        } else {
                                            "Now".to_string()
                                        };

                                        let profile = UserProfile {
                                            name,
                                            email,
                                            tenant_id: tenant,
                                            scopes,
                                            last_login,
                                        };

                                        if let Err(e) = profile.save() {
                                            app.add_log(format!("⚠️ Failed to save profile: {}", e));
                                        }

                                        app.tenant_id = profile.tenant_id.clone();
                                        app.user_profile = Some(profile);
                                        app.add_log("📄 Token Decoded: User Profile Updated & Saved".to_string());
                                    },
                                    Err(e) => {
                                        app.add_log(format!("⚠️ Failed to parse token claims: {}", e));
                                    }
                                }
                            },
                            Err(e) => {
                                app.add_log(format!("❌ Login Failed: {}", e));
                            }
                        }
                        app.is_loading = false;
                    },
                    Some(crate::app::AppAction::ToggleDryRun) => {
                        // already handled in app.rs, just here for completeness if needed
                    },
                    Some(crate::app::AppAction::RunTask { name, args }) => {
                        app.is_loading = true;
                        // Need token
                        let auth = AuthManager::new("common")?;
                        match auth.get_access_token().await {
                            Ok(token) => {
                                app.add_log(format!("🚀 Running Task: {}", name));
                                terminal.draw(|f| crate::ui::render(f, &mut app))?;

                                // We need to pass a callback to update logs.
                                // Since we are in async context but run_task is sync blocking (for now),
                                // we can't easily update the UI *during* the run without threading.
                                // For v1, we will capture logs and update at the end OR 
                                // we accept that UI freezes but we print logs to app.logs buffer.
                                // BUT `run_task` takes a FnMut closure.
                                // We can't pass `&mut app` into the closure easily.
                                // Simpler approach: use a thread-safe channel or just collect logs?
                                // Let's just pass a simple closure that prints for now (debug) or does nothing, 
                                // and we rely on the returned TaskOutput.
                                // Actually, let's try to update app.logs if possible? 
                                // No, borrow checker hell.
                                // Let's just run it and get the result.
                                
                                let result = crate::runner::run_task(&name, &args, &token, |_msg| {
                                    // In a real threaded TUI, we'd send this message to a channel 
                                    // which the main loop polls to update app.logs.
                                    // For now, we ignore progress updates or print to stdout (which breaks TUI).
                                    // Let's just ignore progress for the freeze duration.
                                });

                                match result {
                                    Ok(output) => {
                                        app.task_output = Some(output);
                                        app.add_log("✅ Task Completed Successfully".to_string());
                                    },
                                    Err(e) => {
                                        app.add_log(format!("❌ Task Failed: {}", e));
                                    }
                                }
                            },
                            Err(e) => {
                                app.add_log(format!("❌ Auth Error: {}", e));
                            }
                        }
                        app.is_loading = false;
                    }
                    Some(crate::app::AppAction::BackToMenu) => {
                        app.task_output = None;
                        app.add_log("🔙 Returned to Menu".to_string());
                    }
                    Some(crate::app::AppAction::ExportResults) => {
                        if let Some(output) = &app.task_output {
                            // Simple CSV export using standard IO (since csv crate isn't in cargo.toml yet, let's use simple string joining for now or add csv crate)
                            // Adding csv crate is better but requires restart.
                            // Let's implement simple CSV writer for now to avoid dependency hell in this turn.
                            
                            let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
                            let filename = format!("export_results_{}.csv", timestamp);
                            
                            // Manual CSV generation
                            let mut csv_content = String::new();
                            
                            // Headers
                            if !output.headers.is_empty() {
                                csv_content.push_str(&output.headers.join(","));
                                csv_content.push('\n');
                            }
                            
                            // Rows
                            for row in &output.rows {
                                // Simple escaping: replace " with "" and wrap in " if needed
                                let escaped_row: Vec<String> = row.iter().map(|cell| {
                                    if cell.contains(',') || cell.contains('"') {
                                        format!("\"{}\"", cell.replace("\"", "\"\""))
                                    } else {
                                        cell.clone()
                                    }
                                }).collect();
                                csv_content.push_str(&escaped_row.join(","));
                                csv_content.push('\n');
                            }

                            match fs::write(&filename, csv_content) {
                                Ok(_) => app.add_log(format!("💾 Exported to {}", filename)),
                                Err(e) => app.add_log(format!("❌ Failed to export: {}", e)),
                            }
                        } else {
                            app.add_log("⚠️ No results to export".to_string());
                        }
                    }
                    None => {}
                }
            }
        }

        if last_tick.elapsed() >= tick_rate {
            app.on_tick();
            last_tick = Instant::now();
        }

        if app.should_quit {
            return Ok(());
        }
    }
}