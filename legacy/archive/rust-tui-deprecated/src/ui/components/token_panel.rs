use crate::state::{AppState, AuthStatus};
use crate::ui::styles::{Styles, ICON_KEY};
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Widget},
};

/// Renders the Token Details panel
/// Shows user info, token scopes, expiry countdown
pub fn render_token_panel(state: &AppState, area: Rect, buf: &mut Buffer, is_focused: bool) {
    let border_style = if is_focused {
        Styles::border_focused()
    } else {
        Styles::border()
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(format!(" {} Token Details ", ICON_KEY));

    let lines = match &state.auth_status {
        AuthStatus::Valid(_) => {
            let user = state
                .user_profile
                .as_ref()
                .map(|p| p.email.as_str())
                .unwrap_or("Unknown");

            let expiry_text = state
                .token_expiry_countdown
                .as_ref()
                .map(|s| s.as_str())
                .unwrap_or("Unknown");

            // Determine expiry style based on time remaining
            let expiry_style = if expiry_text.contains("Expired") {
                Styles::token_expired()
            } else if expiry_text.contains("min") {
                // Check if less than 5 minutes
                if let Some(mins) = extract_minutes(expiry_text) {
                    if mins < 5 {
                        Styles::token_warning()
                    } else {
                        Styles::token_valid()
                    }
                } else {
                    Styles::token_valid()
                }
            } else {
                Styles::token_valid()
            };

            vec![
                Line::from(Span::styled("User:", Styles::header())),
                Line::from(format!("  {}", user)),
                Line::from(""),
                Line::from(Span::styled("Token Expiry:", Styles::header())),
                Line::from(vec![Span::styled(format!("  {}", expiry_text), expiry_style)]),
                Line::from(""),
                Line::from(Span::styled("[r] Refresh Token", Styles::muted())),
            ]
        }
        AuthStatus::Unknown => {
            vec![
                Line::from(Span::styled("Status: Not Authenticated", Styles::error_message())),
                Line::from(""),
                Line::from("Run 'o365-cli login' to authenticate"),
            ]
        }
        AuthStatus::Refreshing => {
            vec![
                Line::from(Span::styled("Status: Refreshing...", Styles::warning_message())),
                Line::from(""),
            ]
        }
        AuthStatus::Invalid(ref msg) => {
            vec![
                Line::from(Span::styled("Status: Invalid", Styles::error_message())),
                Line::from(""),
                Line::from(format!("Error: {}", msg)),
                Line::from(""),
                Line::from(Span::styled("[r] Refresh Token", Styles::warning_message())),
            ]
        }
    };

    let paragraph = Paragraph::new(lines).block(block);
    paragraph.render(area, buf);
}

/// Extract minutes from expiry string like "23 min 14 sec"
fn extract_minutes(expiry_text: &str) -> Option<u32> {
    expiry_text
        .split_whitespace()
        .next()
        .and_then(|s| s.parse::<u32>().ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_minutes() {
        assert_eq!(extract_minutes("23 min 14 sec"), Some(23));
        assert_eq!(extract_minutes("4 min 30 sec"), Some(4));
        assert_eq!(extract_minutes("Expired"), None);
    }

    #[test]
    fn test_token_panel_renders() {
        let state = AppState::new();
        let area = Rect::new(0, 0, 40, 10);
        let mut buf = Buffer::empty(area);

        render_token_panel(&state, area, &mut buf, false);
        // If we get here without panic, the test passes
    }
}
