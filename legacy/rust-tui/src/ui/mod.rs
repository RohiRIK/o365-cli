pub mod layout;
pub mod styles;
pub mod components;

use crate::state::{AppState, FocusState};
use components::{
    render_log_viewer, render_modal, render_module_tree, render_settings_dashboard,
    render_status_bar,
};
use layout::LayoutManager;
use ratatui::Frame;

/// Main render function for the TUI
/// This is the entry point for all UI rendering, replacing the old monolithic ui.rs
pub fn render(frame: &mut Frame, state: &AppState) {
    let size = frame.area();

    // Split screen: main area + status bar
    let main_chunks = LayoutManager::main_split(size);
    let main_area = main_chunks[0];
    let status_area = main_chunks[1];

    // Render main content based on focus
    match state.focus {
        FocusState::CategoryTree | FocusState::ModuleList => {
            render_module_view(frame, state, main_area);
        }
        FocusState::SettingsDashboard => {
            render_settings_view(frame, state, main_area);
        }
        FocusState::Logs => {
            render_logs_view(frame, state, main_area);
        }
    }

    // Render status bar (always visible)
    render_status_bar(state, status_area, frame.buffer_mut());

    // Render modal overlay if active
    render_modal(state, size, frame.buffer_mut());
}

/// Renders the Module Management view
/// Layout: Left sidebar (categories) + Right pane (modules + logs)
fn render_module_view(frame: &mut Frame, state: &AppState, area: ratatui::layout::Rect) {
    let horizontal_chunks = LayoutManager::horizontal_split(area);
    let left_area = horizontal_chunks[0];
    let right_area = horizontal_chunks[1];

    // Left: Module tree (categories + modules)
    render_module_tree(state, left_area, frame.buffer_mut());

    // Right: Split into modules detail and logs
    let content_chunks = LayoutManager::content_split(right_area);
    let detail_area = content_chunks[0];
    let logs_area = content_chunks[1];

    // For now, show module tree detail in right pane
    // TODO: In future, could show selected module details here
    render_module_detail_pane(state, detail_area, frame.buffer_mut());

    // Logs at bottom
    render_log_viewer(state, logs_area, frame.buffer_mut());
}

/// Renders the Settings Dashboard view
fn render_settings_view(frame: &mut Frame, state: &AppState, area: ratatui::layout::Rect) {
    render_settings_dashboard(state, area, frame.buffer_mut());
}

/// Renders the Logs-focused view
fn render_logs_view(frame: &mut Frame, state: &AppState, area: ratatui::layout::Rect) {
    // Full screen log viewer when logs are focused
    render_log_viewer(state, area, frame.buffer_mut());
}

/// Renders the module detail pane (right side in module view)
fn render_module_detail_pane(state: &AppState, area: ratatui::layout::Rect, buf: &mut ratatui::buffer::Buffer) {
    use crate::modules::MODULE_REGISTRY;
    use ratatui::widgets::{Block, Borders, Paragraph, Widget, Wrap};
    use styles::Styles;

    let is_focused = matches!(state.focus, FocusState::ModuleList);

    let border_style = if is_focused {
        Styles::border_focused()
    } else {
        Styles::border()
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(" Module Details ");

    // Get current module from registry
    let registry = MODULE_REGISTRY.lock().unwrap();
    let current_category = state.navigation.current_category();
    let modules = registry.modules_by_category(current_category);

    let content = if let Some(module) = modules.get(state.navigation.current_module_index) {
        let implemented = if module.supported { "✅ Implemented" } else { "🚧 Coming Soon" };

        format!(
            "Name: {}\n\nDescription: {}\n\nCategory: {}\n\nStatus: {}\n\n[Enter] Run │ [i] Full Details",
            module.display_name,
            module.description,
            module.category,
            implemented
        )
    } else {
        "No module selected".to_string()
    };

    let paragraph = Paragraph::new(content)
        .block(block)
        .wrap(Wrap { trim: true });

    paragraph.render(area, buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_creation() {
        // Basic test to ensure AppState can be created
        let _state = AppState::new();
    }
}
