use ratatui::layout::{Constraint, Direction, Layout, Rect};

/// Main TUI layout manager
/// Provides consistent screen splits across all views
pub struct LayoutManager;

impl LayoutManager {
    /// Split screen into main area and bottom status bar
    /// Returns: [main_area, status_bar]
    pub fn main_split(area: Rect) -> Vec<Rect> {
        Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Min(0),      // Main content area
                Constraint::Length(5),   // Enhanced status bar (5 lines: 3 auth info + 1 shortcuts + 1 border)
            ])
            .split(area)
            .to_vec()
    }

    /// Split main area into left sidebar and right content
    /// Returns: [sidebar, content]
    pub fn horizontal_split(area: Rect) -> Vec<Rect> {
        Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage(30),  // Left sidebar (categories)
                Constraint::Percentage(70),  // Right content (modules/settings)
            ])
            .split(area)
            .to_vec()
    }

    /// Split right content area into modules and logs
    /// Returns: [modules, logs]
    pub fn content_split(area: Rect) -> Vec<Rect> {
        Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Percentage(60),  // Module list
                Constraint::Percentage(40),  // Logs viewer
            ])
            .split(area)
            .to_vec()
    }

    /// Split settings dashboard into two columns
    /// Returns: [left_column, right_column]
    pub fn settings_split(area: Rect) -> Vec<Rect> {
        Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage(50),  // Left: Token Details, System Health
                Constraint::Percentage(50),  // Right: Configuration, Actions
            ])
            .split(area)
            .to_vec()
    }

    /// Split settings column into sections
    /// Returns sections based on content type
    pub fn settings_column_split(area: Rect, is_left: bool) -> Vec<Rect> {
        if is_left {
            // Left column: Token Details + System Health
            Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(8),   // Token Details panel
                    Constraint::Min(0),      // System Health panel
                ])
                .split(area)
                .to_vec()
        } else {
            // Right column: Configuration + Actions
            Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(12),  // Configuration panel
                    Constraint::Min(0),      // Actions panel
                ])
                .split(area)
                .to_vec()
        }
    }

    /// Create centered modal overlay
    /// Returns: modal area positioned in center of screen
    pub fn modal_overlay(area: Rect, width_percent: u16, height_percent: u16) -> Rect {
        let horizontal = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage((100 - width_percent) / 2),
                Constraint::Percentage(width_percent),
                Constraint::Percentage((100 - width_percent) / 2),
            ])
            .split(area);

        Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Percentage((100 - height_percent) / 2),
                Constraint::Percentage(height_percent),
                Constraint::Percentage((100 - height_percent) / 2),
            ])
            .split(horizontal[1])[1]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_main_split() {
        let area = Rect::new(0, 0, 100, 40);
        let chunks = LayoutManager::main_split(area);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[1].height, 5); // Status bar is 5 lines (enhanced with auth info)
    }

    #[test]
    fn test_horizontal_split() {
        let area = Rect::new(0, 0, 100, 40);
        let chunks = LayoutManager::horizontal_split(area);
        assert_eq!(chunks.len(), 2);
        assert!(chunks[0].width < chunks[1].width); // Sidebar smaller than content
    }

    #[test]
    fn test_modal_overlay() {
        let area = Rect::new(0, 0, 100, 40);
        let modal = LayoutManager::modal_overlay(area, 60, 50);
        assert!(modal.width < area.width);
        assert!(modal.height < area.height);
    }
}
