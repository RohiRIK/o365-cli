use ratatui::style::{Color, Modifier, Style};

/// Centralized color palette and style definitions
/// Provides consistent theming across all UI components
pub struct Styles;

impl Styles {
    // ===== Color Palette =====

    /// Primary accent color (cyan/blue)
    pub const PRIMARY: Color = Color::Cyan;

    /// Success state color (green)
    pub const SUCCESS: Color = Color::Green;

    /// Warning state color (yellow)
    pub const WARNING: Color = Color::Yellow;

    /// Error state color (red)
    pub const ERROR: Color = Color::Red;

    /// Muted/secondary text (gray)
    pub const MUTED: Color = Color::DarkGray;

    /// Default foreground text
    pub const TEXT: Color = Color::White;

    /// Highlight/selection color
    pub const HIGHLIGHT: Color = Color::Yellow;

    // ===== Component Styles =====

    /// Default text style
    pub fn default() -> Style {
        Style::default().fg(Self::TEXT)
    }

    /// Selected/focused item style
    pub fn selected() -> Style {
        Style::default()
            .fg(Self::HIGHLIGHT)
            .add_modifier(Modifier::BOLD)
    }

    /// Disabled/inactive item style
    #[allow(dead_code)] // Will be used for module state visualization
    pub fn disabled() -> Style {
        Style::default()
            .fg(Self::MUTED)
            .add_modifier(Modifier::DIM)
    }

    /// Muted/secondary text style
    pub fn muted() -> Style {
        Style::default().fg(Self::MUTED)
    }

    /// Active/enabled item style
    #[allow(dead_code)] // Will be used for module state visualization
    pub fn enabled() -> Style {
        Style::default().fg(Self::SUCCESS)
    }

    /// Header/title style
    pub fn header() -> Style {
        Style::default()
            .fg(Self::PRIMARY)
            .add_modifier(Modifier::BOLD)
    }

    /// Border style (normal)
    pub fn border() -> Style {
        Style::default().fg(Color::White)
    }

    /// Border style (focused)
    pub fn border_focused() -> Style {
        Style::default().fg(Self::PRIMARY)
    }

    /// Status bar style
    #[allow(dead_code)] // Reserved for future status bar customization
    pub fn status_bar() -> Style {
        Style::default()
            .fg(Self::TEXT)
            .bg(Color::DarkGray)
    }

    /// Success message style
    pub fn success_message() -> Style {
        Style::default()
            .fg(Self::SUCCESS)
            .add_modifier(Modifier::BOLD)
    }

    /// Error message style
    pub fn error_message() -> Style {
        Style::default()
            .fg(Self::ERROR)
            .add_modifier(Modifier::BOLD)
    }

    /// Warning message style
    pub fn warning_message() -> Style {
        Style::default()
            .fg(Self::WARNING)
            .add_modifier(Modifier::BOLD)
    }

    /// Category header style (expanded)
    pub fn category_expanded() -> Style {
        Style::default()
            .fg(Self::PRIMARY)
            .add_modifier(Modifier::BOLD)
    }

    /// Category header style (collapsed)
    pub fn category_collapsed() -> Style {
        Style::default()
            .fg(Color::White)
            .add_modifier(Modifier::BOLD)
    }

    /// Module item style (enabled)
    pub fn module_enabled() -> Style {
        Style::default().fg(Self::SUCCESS)
    }

    /// Module item style (disabled)
    pub fn module_disabled() -> Style {
        Style::default().fg(Self::MUTED)
    }

    /// Input field style
    pub fn input() -> Style {
        Style::default()
            .fg(Self::TEXT)
            .bg(Color::DarkGray)
    }

    /// Modal overlay style
    pub fn modal() -> Style {
        Style::default()
            .fg(Self::TEXT)
            .bg(Color::Black)
    }

    /// Health status: Healthy
    pub fn health_healthy() -> Style {
        Style::default()
            .fg(Self::SUCCESS)
            .add_modifier(Modifier::BOLD)
    }

    /// Health status: Degraded
    pub fn health_degraded() -> Style {
        Style::default()
            .fg(Self::WARNING)
            .add_modifier(Modifier::BOLD)
    }

    /// Health status: Unhealthy
    pub fn health_unhealthy() -> Style {
        Style::default()
            .fg(Self::ERROR)
            .add_modifier(Modifier::BOLD)
    }

    /// Token expiry: Valid (> 5 min)
    pub fn token_valid() -> Style {
        Style::default().fg(Self::SUCCESS)
    }

    /// Token expiry: Warning (< 5 min)
    pub fn token_warning() -> Style {
        Style::default().fg(Self::WARNING)
    }

    /// Token expiry: Expired
    pub fn token_expired() -> Style {
        Style::default().fg(Self::ERROR)
    }
}

// ===== Unicode Icons =====

pub const ICON_CHECKMARK: &str = "[+]";
#[allow(dead_code)] // Reserved for future error states
pub const ICON_CROSS: &str = "❌";
pub const ICON_DISABLED: &str = "[-]";
pub const ICON_ARROW_RIGHT: &str = "▶";
pub const ICON_ARROW_DOWN: &str = "▼";
pub const ICON_LOADING: &str = "⏳";
#[allow(dead_code)] // Reserved for future warning states
pub const ICON_WARNING: &str = "⚠️";
#[allow(dead_code)] // Reserved for future info states
pub const ICON_INFO: &str = "ℹ️";
#[allow(dead_code)] // Reserved for future security indicators
pub const ICON_LOCK: &str = "🔒";
pub const ICON_KEY: &str = "🔑";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_style_creation() {
        let style = Styles::selected();
        assert!(style.fg.is_some());
    }

    #[test]
    fn test_icon_constants() {
        assert!(!ICON_CHECKMARK.is_empty());
        assert!(!ICON_CROSS.is_empty());
    }
}
