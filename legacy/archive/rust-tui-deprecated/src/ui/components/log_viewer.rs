use crate::state::{AppState, FocusState};
use crate::ui::styles::Styles;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    widgets::{Block, Borders, List, ListItem, Widget},
};

/// Renders the Log Viewer panel
/// Shows application logs with scrolling support
pub fn render_log_viewer(state: &AppState, area: Rect, buf: &mut Buffer) {
    let is_focused = matches!(state.focus, FocusState::Logs);

    let border_style = if is_focused {
        Styles::border_focused()
    } else {
        Styles::border()
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(format!(" Logs ({}) ", state.logs.len()));

    // Build log items
    let items: Vec<ListItem> = state
        .logs
        .iter()
        .rev() // Show newest logs first
        .take(100) // Limit to last 100 logs
        .map(|log| {
            // Parse log level from message prefix
            let style = if log.starts_with("ERROR") || log.starts_with("❌") {
                Styles::error_message()
            } else if log.starts_with("WARN") || log.starts_with("⚠") {
                Styles::warning_message()
            } else if log.starts_with("SUCCESS") || log.starts_with("✅") {
                Styles::success_message()
            } else {
                Styles::default()
            };

            ListItem::new(log.as_str()).style(style)
        })
        .collect();

    let list = List::new(items).block(block);

    list.render(area, buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_viewer_empty() {
        let state = AppState::new();
        let area = Rect::new(0, 0, 80, 20);
        let mut buf = Buffer::empty(area);

        render_log_viewer(&state, area, &mut buf);
        // If we get here without panic, the test passes
    }

    #[test]
    fn test_log_viewer_with_logs() {
        let mut state = AppState::new();
        state.add_log("INFO: Test log message".to_string());
        state.add_log("ERROR: Test error message".to_string());
        state.add_log("WARN: Test warning message".to_string());

        let area = Rect::new(0, 0, 80, 20);
        let mut buf = Buffer::empty(area);

        render_log_viewer(&state, area, &mut buf);
        // If we get here without panic, the test passes
    }
}
