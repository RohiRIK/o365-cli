use crate::state::{AppState, HealthStatus};
use crate::ui::styles::Styles;
use ratatui::{
    buffer::Buffer,
    layout::Rect,
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Widget},
};

/// Renders the System Health panel
/// Shows API latency, version, environment, health status
pub fn render_health_panel(state: &AppState, area: Rect, buf: &mut Buffer, is_focused: bool) {
    let border_style = if is_focused {
        Styles::border_focused()
    } else {
        Styles::border()
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(" System Health ");

    // API Latency
    let latency_text = state.health.latency_string();
    let latency_style = match state.health.health_status {
        HealthStatus::Healthy => Styles::health_healthy(),
        HealthStatus::Degraded => Styles::health_degraded(),
        HealthStatus::Unhealthy => Styles::health_unhealthy(),
        HealthStatus::Unknown => Styles::muted(),
    };

    // Environment
    let env_text = format!("{}", state.health.environment);
    let env_style = match state.health.environment {
        crate::state::Environment::Production => Styles::success_message(),
        crate::state::Environment::Development => Styles::warning_message(),
        crate::state::Environment::Test => Styles::muted(),
    };

    // Health Status
    let status_icon = state.health.status_icon();
    let status_text = format!("{:?}", state.health.health_status);
    let status_style = match state.health.health_status {
        HealthStatus::Healthy => Styles::health_healthy(),
        HealthStatus::Degraded => Styles::health_degraded(),
        HealthStatus::Unhealthy => Styles::health_unhealthy(),
        HealthStatus::Unknown => Styles::muted(),
    };

    let lines = vec![
        Line::from(Span::styled("API Latency:", Styles::header())),
        Line::from(vec![Span::styled(format!("  {}", latency_text), latency_style)]),
        Line::from(""),
        Line::from(Span::styled("Version:", Styles::header())),
        Line::from(format!("  {}", state.health.version)),
        Line::from(""),
        Line::from(Span::styled("Environment:", Styles::header())),
        Line::from(vec![Span::styled(format!("  {}", env_text), env_style)]),
        Line::from(""),
        Line::from(Span::styled("Health Status:", Styles::header())),
        Line::from(vec![
            Span::styled(format!("  {} ", status_icon), status_style),
            Span::styled(status_text, status_style),
        ]),
    ];

    let paragraph = Paragraph::new(lines).block(block);
    paragraph.render(area, buf);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_panel_renders() {
        let state = AppState::new();
        let area = Rect::new(0, 0, 40, 15);
        let mut buf = Buffer::empty(area);

        render_health_panel(&state, area, &mut buf, false);
        // If we get here without panic, the test passes
    }
}
