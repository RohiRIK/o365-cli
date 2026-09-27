use crate::state::{AppState, ModalState};
use crate::ui::layout::LayoutManager;
use crate::ui::styles::Styles;
use ratatui::{
    buffer::Buffer,
    layout::{Alignment, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, Paragraph, Widget, Wrap},
};

/// Renders modal overlays based on current ModalState
pub fn render_modal(state: &AppState, area: Rect, buf: &mut Buffer) {
    match &state.modal {
        ModalState::None => {
            // No modal to render
        }
        ModalState::Input(context) => {
            render_input_modal(state, area, buf, context);
        }
        ModalState::ModuleInput {
            module_name,
            inputs,
            current_input_index,
            buffer,
            error_message,
            ..
        } => {
            render_module_input_modal(area, buf, module_name, inputs, *current_input_index, buffer, error_message);
        }
        ModalState::ExecutionProgress {
            module_name,
            progress,
            message,
            logs,
            ..
        } => {
            render_execution_progress_modal(area, buf, module_name, *progress, message, logs);
        }
        ModalState::Review { task_name, args } => {
            render_review_modal_with_task(state, area, buf, task_name, args);
        }
        ModalState::Confirm(action) => {
            render_confirm_modal(state, area, buf, action);
        }
        ModalState::ModuleDetail(module_id) => {
            render_module_detail_modal(state, area, buf, module_id);
        }
        ModalState::Filter => {
            render_filter_modal(state, area, buf);
        }
        ModalState::LoginFlow { stage, auth_url, message, error } => {
            render_login_flow_modal(area, buf, stage, auth_url, message, error);
        }
    }
}

use crate::state::app_state::InputContext;

/// Renders an input modal for collecting user input
fn render_input_modal(state: &AppState, area: Rect, buf: &mut Buffer, context: &InputContext) {
    let modal_area = LayoutManager::modal_overlay(area, 60, 30);

    // Clear the background
    Clear.render(modal_area, buf);

    // Determine the prompt text based on context
    let prompt_text = match context {
        InputContext::None => "Input",
        InputContext::OffboardUserEmail => "Enter User Email",
        InputContext::OffboardManagerEmail { .. } => "Enter Manager Email",
        InputContext::OffboardDeviceAction { .. } => "Select Device Action",
        InputContext::GuestCleanupThreshold => "Enter Days Threshold",
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border_focused())
        .title(format!(" {} ", prompt_text))
        .style(Styles::modal());

    let lines = vec![
        Line::from(""),
        Line::from(Span::styled("Enter value:", Styles::header())),
        Line::from(""),
        Line::from(Span::styled(
            format!("> {}_", state.input_buffer),
            Styles::input(),
        )),
        Line::from(""),
        Line::from(Span::styled("[Enter] Submit │ [Esc] Cancel", Styles::muted())),
    ];

    let paragraph = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(modal_area, buf);
}

/// Renders a review modal showing a list of actions to confirm
fn render_review_modal_with_task(_state: &AppState, area: Rect, buf: &mut Buffer, task_name: &str, args: &[String]) {
    let modal_area = LayoutManager::modal_overlay(area, 70, 50);

    Clear.render(modal_area, buf);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border_focused())
        .title(format!(" Review: {} ", task_name))
        .style(Styles::modal());

    let mut lines = vec![
        Line::from(Span::styled("Task arguments:", Styles::header())),
        Line::from(""),
    ];

    for (idx, arg) in args.iter().enumerate() {
        lines.push(Line::from(format!("  {}. {}", idx + 1, arg)));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "[Enter] Confirm │ [Esc] Cancel",
        Styles::muted(),
    )));

    let paragraph = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(modal_area, buf);
}

/// Renders a confirmation modal for destructive actions
fn render_confirm_modal(_state: &AppState, area: Rect, buf: &mut Buffer, action: &crate::state::ConfirmAction) {
    let modal_area = LayoutManager::modal_overlay(area, 50, 25);

    Clear.render(modal_area, buf);

    let (title, message, warning) = match action {
        crate::state::ConfirmAction::ClearTaskHistory => (
            "Clear Task History",
            "This will clear all cached task results.",
            "This action cannot be undone.",
        ),
        crate::state::ConfirmAction::ClearTokenCache => (
            "Clear Token Cache",
            "This will delete all cached tokens and force re-authentication.",
            "You will need to log in again.",
        ),
        crate::state::ConfirmAction::DisableAllModules => (
            "Disable All Modules",
            "This will disable all modules in the configuration.",
            "You can re-enable them later.",
        ),
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border_focused())
        .title(format!(" {} ", title))
        .style(Styles::modal());

    let lines = vec![
        Line::from(""),
        Line::from(message),
        Line::from(""),
        Line::from(Span::styled(warning, Styles::warning_message())),
        Line::from(""),
        Line::from(""),
        Line::from(Span::styled("[y] Confirm │ [n] Cancel", Styles::muted())),
    ];

    let paragraph = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(modal_area, buf);
}

/// Renders module detail modal showing full description and parameters
fn render_module_detail_modal(state: &AppState, area: Rect, buf: &mut Buffer, module_id: &str) {
    let modal_area = LayoutManager::modal_overlay(area, 70, 60);

    Clear.render(modal_area, buf);

    // Look up module details from registry
    let registry = crate::modules::MODULE_REGISTRY.lock().unwrap();
    let module_info = registry.config.get_module(module_id);

    let title = if let Some(module) = module_info {
        format!(" {} ", module.display_name)
    } else {
        format!(" Module: {} ", module_id)
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border_focused())
        .title(title)
        .style(Styles::modal());

    let lines = if let Some(module) = module_info {
        // Special handling for Settings modules
        if module.category == "Settings" {
            match module_id {
                "settings:authentication" => {
                    vec![
                        Line::from(Span::styled("Authentication & Tokens", Styles::header())),
                        Line::from(""),
                        Line::from(Span::styled("Tenant ID:", Styles::header())),
                        Line::from(format!("  {}", state.tenant_id)),
                        Line::from(""),
                        Line::from(Span::styled("Session Status:", Styles::header())),
                        Line::from(format!("  {}", if matches!(state.auth_status, crate::state::app_state::AuthStatus::Valid(_)) { "✓ Authenticated" } else { "✗ Not Authenticated" })),
                        Line::from(""),
                        Line::from(Span::styled("Token Details:", Styles::muted())),
                        Line::from("  OAuth tokens are securely stored in OS keyring"),
                        Line::from("  Access tokens expire after 1 hour"),
                        Line::from("  Refresh tokens are used to obtain new access tokens"),
                        Line::from(""),
                        Line::from(Span::styled("Actions:", Styles::header())),
                        Line::from("  Press [L] to login via browser"),
                        Line::from("  Press [Esc] to close this panel"),
                        Line::from(""),
                        Line::from(Span::styled("[L] Login  [Esc] Close", Styles::muted())),
                    ]
                }
                "settings:configuration" => {
                    vec![
                        Line::from(Span::styled("Execution Configuration", Styles::header())),
                        Line::from(""),
                        Line::from(Span::styled("Concurrency Settings:", Styles::header())),
                        Line::from(format!("  Max Workers: {}", state.config.execution.concurrency_limit)),
                        Line::from(format!("  Retry Attempts: {}", state.config.execution.retry_attempts)),
                        Line::from(""),
                        Line::from(Span::styled("Dry-Run Mode:", Styles::header())),
                        Line::from(format!("  Default: {}", if state.config.execution.default_dry_run { "Enabled (Safe)" } else { "Disabled (Live)" })),
                        Line::from("  When enabled, modules simulate actions without making changes"),
                        Line::from(""),
                        Line::from(Span::styled("Module Registry:", Styles::header())),
                        Line::from(format!("  Total Modules: {}", registry.config.modules.len())),
                        Line::from(format!("  Supported: {}", registry.config.modules.iter().filter(|m| m.supported).count())),
                        Line::from(""),
                        Line::from(Span::styled("[Esc] Close", Styles::muted())),
                    ]
                }
                "settings:health" => {
                    vec![
                        Line::from(Span::styled("System Health", Styles::header())),
                        Line::from(""),
                        Line::from(Span::styled("Microsoft Graph API:", Styles::header())),
                        Line::from(format!("  Status: {}", match state.health.health_status {
                            crate::state::health::HealthStatus::Healthy => "✓ Healthy",
                            crate::state::health::HealthStatus::Degraded => "⚠ Degraded",
                            crate::state::health::HealthStatus::Unhealthy => "✗ Unhealthy",
                            crate::state::health::HealthStatus::Unknown => "? Unknown",
                        })),
                        Line::from(format!("  Latency: {} ms", state.health.api_latency_ms.unwrap_or(0))),
                        Line::from(""),
                        Line::from(Span::styled("Connectivity:", Styles::header())),
                        Line::from("  Endpoint: https://graph.microsoft.com/v1.0"),
                        Line::from("  Health checks run every 30 seconds"),
                        Line::from(""),
                        Line::from(Span::styled("Performance:", Styles::header())),
                        Line::from("  TUI refresh rate: 250ms"),
                        Line::from(format!("  IPC protocol: v{}", registry.config.system.ipc_version)),
                        Line::from(""),
                        Line::from(Span::styled("[Esc] Close", Styles::muted())),
                    ]
                }
                _ => {
                    vec![
                        Line::from(Span::styled("Settings module not recognized", Styles::warning_message())),
                        Line::from(""),
                        Line::from(Span::styled("[Esc] Close", Styles::muted())),
                    ]
                }
            }
        } else {
            // Standard module detail view
            vec![
                Line::from(Span::styled("Name:", Styles::header())),
                Line::from(format!("  {}", module.display_name)),
                Line::from(""),
                Line::from(Span::styled("Description:", Styles::header())),
                Line::from(format!("  {}", module.description)),
                Line::from(""),
                Line::from(Span::styled("Category:", Styles::header())),
                Line::from(format!("  {}", module.category)),
                Line::from(""),
                Line::from(Span::styled("[Esc] Close", Styles::muted())),
            ]
        }
    } else {
        vec![
            Line::from(Span::styled("Module not found", Styles::error_message())),
            Line::from(""),
            Line::from(Span::styled("[Esc] Close", Styles::muted())),
        ]
    };

    let paragraph = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(modal_area, buf);
}

/// Renders filter input modal
fn render_filter_modal(state: &AppState, area: Rect, buf: &mut Buffer) {
    let modal_area = LayoutManager::modal_overlay(area, 50, 20);

    Clear.render(modal_area, buf);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border_focused())
        .title(" Filter Modules ")
        .style(Styles::modal());

    let lines = vec![
        Line::from(""),
        Line::from(Span::styled("Filter by name:", Styles::header())),
        Line::from(""),
        Line::from(Span::styled(
            format!("> {}_", state.filter_buffer),
            Styles::input(),
        )),
        Line::from(""),
        Line::from(Span::styled("[Enter] Apply │ [Esc] Cancel", Styles::muted())),
    ];

    let paragraph = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(modal_area, buf);
}

/// Renders the module input collection modal
fn render_module_input_modal(
    area: Rect,
    buf: &mut Buffer,
    module_name: &str,
    inputs: &[crate::modules::InputDefinition],
    current_index: usize,
    buffer: &str,
    error_message: &Option<String>,
) {
    let modal_area = LayoutManager::modal_overlay(area, 70, 50);

    Clear.render(modal_area, buf);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border_focused())
        .title(format!(" Configure: {} ", module_name))
        .style(Styles::modal());

    let mut lines = vec![];

    if let Some(input) = inputs.get(current_index) {
        // Progress indicator
        lines.push(Line::from(Span::styled(
            format!("Step {}/{}", current_index + 1, inputs.len()),
            Styles::muted(),
        )));
        lines.push(Line::from(""));

        // Prompt
        lines.push(Line::from(Span::styled(&input.prompt, Styles::header())));
        lines.push(Line::from(""));

        // Input type hint
        let type_hint = match input.input_type.as_str() {
            "email" => "Email address",
            "number" => "Number",
            "choice" => "Choice",
            _ => "Text",
        };
        lines.push(Line::from(Span::styled(
            format!("Type: {}", type_hint),
            Styles::muted(),
        )));

        // Show choices if applicable
        if let Some(ref choices) = input.choices {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled("Available options:", Styles::muted())));
            for choice in choices {
                lines.push(Line::from(format!("  • {}", choice)));
            }
        }

        lines.push(Line::from(""));

        // Input field
        lines.push(Line::from(Span::styled(
            format!("> {}_", buffer),
            Styles::input(),
        )));

        // Error message if present
        if let Some(err) = error_message {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                format!("Error: {}", err),
                Styles::error_message(),
            )));
        }

        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            "[Enter] Next │ [Esc] Cancel",
            Styles::muted(),
        )));
    }

    let paragraph = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(modal_area, buf);
}

/// Renders the execution progress modal
fn render_execution_progress_modal(
    area: Rect,
    buf: &mut Buffer,
    module_name: &str,
    progress: u8,
    message: &str,
    logs: &[String],
) {
    let modal_area = LayoutManager::modal_overlay(area, 80, 60);

    Clear.render(modal_area, buf);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border_focused())
        .title(format!(" Executing: {} ", module_name))
        .style(Styles::modal());

    let mut lines = vec![];

    // Progress bar
    let progress_bar_width = 40;
    let filled = ((progress as usize) * progress_bar_width / 100).min(progress_bar_width);
    let empty = progress_bar_width - filled;
    let bar = format!(
        "[{}{}] {}%",
        "=".repeat(filled),
        " ".repeat(empty),
        progress
    );
    lines.push(Line::from(Span::styled(bar, Styles::header())));
    lines.push(Line::from(""));

    // Current message
    lines.push(Line::from(Span::styled(message, Styles::default())));
    lines.push(Line::from(""));

    // Logs
    if !logs.is_empty() {
        lines.push(Line::from(Span::styled("Execution Log:", Styles::muted())));
        lines.push(Line::from(""));

        // Show last 10 logs
        let start_idx = logs.len().saturating_sub(10);
        for log in &logs[start_idx..] {
            lines.push(Line::from(format!("  {}", log)));
        }
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "[Esc] Cancel",
        Styles::muted(),
    )));

    let paragraph = Paragraph::new(lines)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(modal_area, buf);
}

/// Renders the OAuth login flow modal
fn render_login_flow_modal(
    area: Rect,
    buf: &mut Buffer,
    stage: &crate::state::LoginStage,
    auth_url: &Option<String>,
    message: &str,
    error: &Option<String>,
) {
    let modal_area = LayoutManager::modal_overlay(area, 70, 50);

    // Clear the background
    Clear.render(modal_area, buf);

    // Build content based on stage
    let lines = match stage {
        crate::state::LoginStage::Initializing => {
            vec![
                Line::from(Span::styled("🔐 Microsoft 365 Login", Styles::header())),
                Line::from(""),
                Line::from(Span::styled(message, Styles::muted())),
                Line::from(""),
                Line::from("Please wait..."),
                Line::from(""),
                Line::from(Span::styled("[Esc] Cancel", Styles::muted())),
            ]
        }
        crate::state::LoginStage::WaitingForBrowser => {
            let mut lines = vec![
                Line::from(Span::styled("🔐 Microsoft 365 Login", Styles::header())),
                Line::from(""),
                Line::from(Span::styled("Opening browser for authentication...", Styles::success_message())),
                Line::from(""),
            ];

            if let Some(url) = auth_url {
                lines.push(Line::from(Span::styled("If browser doesn't open automatically:", Styles::header())));
                lines.push(Line::from(""));
                lines.push(Line::from(Span::styled("Copy this URL:", Styles::muted())));
                lines.push(Line::from(url.clone()));
                lines.push(Line::from(""));
            }

            lines.push(Line::from("1. Complete authentication in your browser"));
            lines.push(Line::from("2. Grant requested permissions"));
            lines.push(Line::from("3. Wait for redirect..."));
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled("[Esc] Cancel", Styles::muted())));

            lines
        }
        crate::state::LoginStage::PollingForToken => {
            vec![
                Line::from(Span::styled("🔐 Microsoft 365 Login", Styles::header())),
                Line::from(""),
                Line::from(Span::styled(message, Styles::muted())),
                Line::from(""),
                Line::from("⏳ Exchanging authorization code for tokens..."),
                Line::from(""),
                Line::from(Span::styled("[Esc] Cancel", Styles::muted())),
            ]
        }
        crate::state::LoginStage::Success => {
            vec![
                Line::from(Span::styled("✅ Login Successful!", Styles::success_message())),
                Line::from(""),
                Line::from(message.to_string()),
                Line::from(""),
                Line::from("Your OAuth tokens have been securely stored."),
                Line::from("You can now execute modules that require authentication."),
                Line::from(""),
                Line::from(Span::styled("[Enter] Continue", Styles::muted())),
            ]
        }
        crate::state::LoginStage::Failed => {
            let mut lines = vec![
                Line::from(Span::styled("❌ Login Failed", Styles::error_message())),
                Line::from(""),
            ];

            if let Some(err) = error {
                lines.push(Line::from(Span::styled("Error:", Styles::header())));
                lines.push(Line::from(format!("  {}", err)));
                lines.push(Line::from(""));
            }

            lines.push(Line::from("Please try again or check your network connection."));
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled("[Enter] Close", Styles::muted())));

            lines
        }
    };

    // Create paragraph widget
    let paragraph = Paragraph::new(lines)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Styles::border_focused())
                .title(" Login ")
                .title_style(Styles::header()),
        )
        .wrap(Wrap { trim: true })
        .alignment(Alignment::Left);

    paragraph.render(modal_area, buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_modal_renders_none() {
        let state = AppState::new();
        let area = Rect::new(0, 0, 100, 40);
        let mut buf = Buffer::empty(area);

        render_modal(&state, area, &mut buf);
        // If we get here without panic, the test passes
    }
}
