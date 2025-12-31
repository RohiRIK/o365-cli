use crate::state::{AppState, FocusState};
use crate::ui::layout::LayoutManager;
use crate::ui::components::{render_token_panel, render_health_panel};
use crate::ui::styles::Styles;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Widget},
};

/// Renders the Advanced Settings Dashboard
/// Layout: Two columns (Token/Health | Configuration/Actions)
pub fn render_settings_dashboard(state: &AppState, area: Rect, buf: &mut Buffer) {
    let is_focused = matches!(state.focus, FocusState::SettingsDashboard);

    // Split into two columns
    let columns = LayoutManager::settings_split(area);
    let left_area = columns[0];
    let right_area = columns[1];

    // Left column: Token Details + System Health
    let left_sections = LayoutManager::settings_column_split(left_area, true);
    render_token_panel(state, left_sections[0], buf, is_focused);
    render_health_panel(state, left_sections[1], buf, is_focused);

    // Right column: Configuration + Actions
    let right_sections = LayoutManager::settings_column_split(right_area, false);
    render_configuration_panel(state, right_sections[0], buf, is_focused);
    render_actions_panel(state, right_sections[1], buf, is_focused);
}

/// Renders the Configuration panel
fn render_configuration_panel(state: &AppState, area: Rect, buf: &mut Buffer, is_focused: bool) {
    let border_style = if is_focused {
        Styles::border_focused()
    } else {
        Styles::border()
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(" Configuration ");

    let compact_status = if state.config.appearance.compact_mode {
        "[✓] Compact Mode"
    } else {
        "[ ] Compact Mode"
    };

    let show_desc_status = if state.config.appearance.show_descriptions {
        "[✓] Show Descriptions"
    } else {
        "[ ] Show Descriptions"
    };

    let dry_run_status = if state.config.execution.default_dry_run {
        "[✓] Default Dry Run"
    } else {
        "[ ] Default Dry Run"
    };

    let lines = vec![
        Line::from(Span::styled("Appearance:", Styles::header())),
        Line::from(format!("  {}", compact_status)),
        Line::from(format!("  {}", show_desc_status)),
        Line::from(""),
        Line::from(Span::styled("Execution:", Styles::header())),
        Line::from(format!(
            "  Concurrency Limit: {}",
            state.config.execution.concurrency_limit
        )),
        Line::from(format!(
            "  Retry Attempts: {}",
            state.config.execution.retry_attempts
        )),
        Line::from(format!("  {}", dry_run_status)),
    ];

    let paragraph = Paragraph::new(lines).block(block);
    paragraph.render(area, buf);
}

/// Renders the Actions panel
fn render_actions_panel(_state: &AppState, area: Rect, buf: &mut Buffer, is_focused: bool) {
    let border_style = if is_focused {
        Styles::border_focused()
    } else {
        Styles::border()
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(" Actions ");

    let lines = vec![
        Line::from(Span::styled("Available Actions:", Styles::header())),
        Line::from(""),
        Line::from("  [c] Clear Task History"),
        Line::from("  [t] Clear Token Cache (force re-auth)"),
        Line::from("  [x] Export Configuration"),
        Line::from("  [r] Refresh Token"),
        Line::from(""),
        Line::from(Span::styled("Keyboard Shortcuts:", Styles::header())),
        Line::from(""),
        Line::from("  [Tab]   Cycle focus"),
        Line::from("  [1-6]   Jump to category"),
        Line::from("  [Space] Toggle module"),
        Line::from("  [q/Esc] Quit/Cancel"),
    ];

    let paragraph = Paragraph::new(lines).block(block);
    paragraph.render(area, buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settings_dashboard_renders() {
        let state = AppState::new();
        let area = Rect::new(0, 0, 80, 30);
        let mut buf = Buffer::empty(area);

        render_settings_dashboard(&state, area, &mut buf);
        // If we get here without panic, the test passes
    }
}
