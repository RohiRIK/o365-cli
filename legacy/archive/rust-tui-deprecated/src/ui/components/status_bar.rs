use crate::state::{AppState, AuthStatus};
use crate::ui::styles::{Styles, ICON_LOADING};
use ratatui::{
    buffer::Buffer,
    layout::{Constraint, Direction, Layout, Rect},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Widget},
};

/// Renders the bottom status bar with enhanced authentication info
/// Shows auth details, user profile, health status, and quick actions
pub fn render_status_bar(state: &AppState, area: Rect, buf: &mut Buffer) {
    // Split into two rows: top row for auth details, bottom row for shortcuts
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Auth info panel
            Constraint::Length(1), // Shortcuts bar
        ])
        .split(area);

    render_auth_info_panel(state, chunks[0], buf);
    render_shortcuts_bar(state, chunks[1], buf);
}

/// Renders the authentication information panel (top part of status bar)
fn render_auth_info_panel(state: &AppState, area: Rect, buf: &mut Buffer) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Styles::border())
        .title(" Authentication & System Info ");

    // Split into 3 columns: User Info | Token Status | Health & Actions
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(40),
            Constraint::Percentage(30),
            Constraint::Percentage(30),
        ])
        .split(block.inner(area));

    block.render(area, buf);

    // Column 1: User Profile Info
    render_user_info(state, columns[0], buf);

    // Column 2: Token Status
    render_token_status(state, columns[1], buf);

    // Column 3: Health & Quick Actions
    render_health_and_actions(state, columns[2], buf);
}

/// Renders user profile information
fn render_user_info(state: &AppState, area: Rect, buf: &mut Buffer) {
    let lines = if let Some(ref profile) = state.user_profile {
        vec![
            Line::from(vec![
                Span::styled("User: ", Styles::muted()),
                Span::styled(&profile.email, Styles::header()),
            ]),
            Line::from(vec![
                Span::styled("Tenant: ", Styles::muted()),
                Span::raw(&profile.tenant_id[..profile.tenant_id.len().min(25)]),
            ]),
            Line::from(vec![
                Span::styled("Last Login: ", Styles::muted()),
                Span::raw(&profile.last_login),
            ]),
        ]
    } else {
        vec![
            Line::from(Span::styled("Not Authenticated", Styles::error_message())),
            Line::from(Span::styled("Run: o365-cli login", Styles::muted())),
            Line::from(""),
        ]
    };

    let paragraph = Paragraph::new(lines);
    paragraph.render(area, buf);
}

/// Renders token expiry status
fn render_token_status(state: &AppState, area: Rect, buf: &mut Buffer) {
    let lines = match &state.auth_status {
        AuthStatus::Valid(_) => {
            let countdown = state
                .token_expiry_countdown
                .as_ref()
                .map(|s| s.as_str())
                .unwrap_or("Unknown");

            let (icon, style) = if countdown.contains("Expired") {
                ("🔴", Styles::token_expired())
            } else if let Some(mins) = extract_minutes_from_countdown(countdown) {
                if mins < 5 {
                    ("🟡", Styles::token_warning())
                } else {
                    ("🟢", Styles::token_valid())
                }
            } else {
                ("🟢", Styles::token_valid())
            };

            vec![
                Line::from(vec![
                    Span::raw(format!("{} ", icon)),
                    Span::styled("Token Status: Active", style),
                ]),
                Line::from(vec![
                    Span::styled("Expires in: ", Styles::muted()),
                    Span::styled(countdown, style),
                ]),
                Line::from(vec![
                    Span::styled("Quick: ", Styles::muted()),
                    Span::styled("[r]", Styles::header()),
                    Span::raw(" Refresh"),
                ]),
            ]
        }
        AuthStatus::Unknown => {
            vec![
                Line::from(Span::styled("🔴 No Token", Styles::error_message())),
                Line::from(Span::styled("Please authenticate", Styles::muted())),
                Line::from(""),
            ]
        }
        AuthStatus::Refreshing => {
            vec![
                Line::from(Span::styled("🟡 Refreshing...", Styles::warning_message())),
                Line::from(Span::styled("Please wait", Styles::muted())),
                Line::from(""),
            ]
        }
        AuthStatus::Invalid(ref msg) => {
            vec![
                Line::from(Span::styled("🔴 Invalid Token", Styles::error_message())),
                Line::from(Span::styled(msg, Styles::muted())),
                Line::from(""),
            ]
        }
    };

    let paragraph = Paragraph::new(lines);
    paragraph.render(area, buf);
}

/// Renders health status and quick actions
fn render_health_and_actions(state: &AppState, area: Rect, buf: &mut Buffer) {
    let health_icon = state.health.status_icon();
    let health_status = format!("{:?}", state.health.health_status);
    let latency = state.health.latency_string();

    let lines = vec![
        Line::from(vec![
            Span::raw(format!("{} ", health_icon)),
            Span::styled(format!("API: {}", health_status), Styles::header()),
        ]),
        Line::from(vec![
            Span::styled("Latency: ", Styles::muted()),
            Span::raw(latency),
        ]),
        Line::from(vec![
            Span::styled("Env: ", Styles::muted()),
            Span::raw(format!("{}", state.health.environment)),
        ]),
    ];

    let paragraph = Paragraph::new(lines);
    paragraph.render(area, buf);
}

/// Renders the keyboard shortcuts bar (bottom part)
fn render_shortcuts_bar(state: &AppState, area: Rect, buf: &mut Buffer) {
    let block = Block::default();

    // Build status line components
    let mut spans = vec![];

    // Loading indicator
    if state.is_loading {
        spans.push(Span::styled(format!("{} Loading...", ICON_LOADING), Styles::warning_message()));
        spans.push(Span::raw(" │ "));
    }

    // Keyboard shortcuts based on focus
    let shortcuts = match state.focus {
        crate::state::FocusState::CategoryTree => {
            "[j/k] Navigate │ [Enter] Expand │ [Space] Toggle │ [1-6] Jump │ [Tab] Next Panel"
        }
        crate::state::FocusState::ModuleList => {
            "[j/k] Navigate │ [Space] Toggle │ [Enter] Run │ [i] Details │ [a] Enable All │ [n] Disable All"
        }
        crate::state::FocusState::SettingsDashboard => {
            "[c] Clear History │ [t] Clear Token │ [x] Export Config │ [r] Refresh Token │ [Tab] Next"
        }
        crate::state::FocusState::Logs => {
            "[j/k] Scroll │ [Tab] Next Panel"
        }
    };

    spans.push(Span::styled(shortcuts, Styles::muted()));

    // Right-aligned quit shortcut
    let quit_text = " [q] Quit ";
    let available_width = area.width.saturating_sub(2); // Account for borders
    let spans_width: u16 = spans.iter().map(|s| s.width() as u16).sum();
    let padding = available_width.saturating_sub(spans_width).saturating_sub(quit_text.len() as u16);

    if padding > 0 {
        spans.push(Span::raw(" ".repeat(padding as usize)));
    }
    spans.push(Span::styled(quit_text, Styles::error_message()));

    let line = Line::from(spans);
    let paragraph = Paragraph::new(line).block(block);

    paragraph.render(area, buf);
}

/// Extract minutes from countdown string like "(23 min 14 sec)"
fn extract_minutes_from_countdown(countdown: &str) -> Option<u32> {
    countdown
        .trim_start_matches('(')
        .split_whitespace()
        .next()
        .and_then(|s| s.parse::<u32>().ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_minutes_from_countdown() {
        assert_eq!(extract_minutes_from_countdown("(23 min 14 sec)"), Some(23));
        assert_eq!(extract_minutes_from_countdown("(4 min 30 sec)"), Some(4));
        assert_eq!(extract_minutes_from_countdown(""), None);
    }

    #[test]
    fn test_status_bar_renders() {
        let state = AppState::new();
        let area = Rect::new(0, 0, 100, 3);
        let mut buf = Buffer::empty(area);

        render_status_bar(&state, area, &mut buf);
        // If we get here without panic, the test passes
    }
}
