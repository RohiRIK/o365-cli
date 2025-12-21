use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Clear, Table, Row, Cell, Paragraph, Wrap},
    Frame,
};
use crate::app::{App, CurrentTab, Focus};

pub fn render(f: &mut Frame, app: &mut App) {
    // 1. Vertical Layout: Top (Main Area) vs Bottom (Status/Logs)
    let vertical_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(10),      // Main Area (Grows)
            Constraint::Length(7),    // Bottom Log Area (Fixed height)
        ].as_ref())
        .split(f.area());

    // 2. Horizontal Layout (Inside Main Area): Left (Menu) vs Right (Content)
    let main_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(20), // Left Sidebar
            Constraint::Percentage(80), // Right Content
        ].as_ref())
        .split(vertical_chunks[0]);

    let left_area = main_chunks[0];
    let right_area = main_chunks[1];
    let bottom_area = vertical_chunks[1];

    // --- STYLES ---
    let active_border_style = Style::default().fg(Color::Blue);
    let inactive_border_style = Style::default().fg(Color::DarkGray);

    let menu_border_style = if app.focus == Focus::Menu { active_border_style } else { inactive_border_style };
    let content_border_style = if app.focus == Focus::Content { active_border_style } else { inactive_border_style };
    let logs_border_style = if app.focus == Focus::Logs { active_border_style } else { inactive_border_style };


    // --- LEFT PANE: Navigation Menu ---
    let menu_titles = vec![
        "1. Security",
        "2. IAM",
        "3. Settings",
    ];

    let menu_items: Vec<ListItem> = menu_titles
        .iter()
        .map(|t| {
            let style = if (t.contains("Security") && app.current_tab == CurrentTab::Security) ||
                           (t.contains("IAM") && app.current_tab == CurrentTab::IAM) ||
                           (t.contains("Settings") && app.current_tab == CurrentTab::Settings) {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            ListItem::new(Span::styled(*t, style))
        })
        .collect();

    let menu_list = List::new(menu_items)
        .block(Block::default().borders(Borders::ALL).border_style(menu_border_style).title("Menu"))
        .highlight_style(Style::default().add_modifier(Modifier::BOLD));

    f.render_widget(Clear, left_area); // Clear background to prevent artifacts
    f.render_widget(menu_list, left_area);

    // --- RIGHT PANE: Active View ---
    let is_content_focused = app.focus == Focus::Content;

    // Check if we have a task result to show
    if let Some(output) = &app.task_output {
        // Render Result Table
        if !output.headers.is_empty() {
            let header_cells = output.headers.iter().map(|h| Cell::from(Span::styled(h.as_str(), Style::default().fg(Color::White).add_modifier(Modifier::BOLD))));
            let header = Row::new(header_cells).height(1).bottom_margin(1);
            
            let rows = output.rows.iter().map(|row| {
                let action_type = &row[0];
                // Sanitize detail message: replace newlines with spaces to prevent table layout breakage
                let detail_message = row[1].replace('\n', " ").replace('\r', "");

                let type_style = get_action_style(action_type);
                
                let detail_cell = Cell::from(Span::styled(detail_message.clone(), Style::default().fg(Color::White)))
                    .style(Style::default()); 

                Row::new(vec![
                    Cell::from(Span::styled(action_type.as_str(), type_style)),
                    detail_cell,
                ]).height(1) // Force single line height for cleanliness, let user scroll or export for full details
            });
            
            // Fixed width for "Type", dynamic for "Detail"
            let widths = [
                Constraint::Length(10), // "Type" column fixed width
                Constraint::Min(0),     // "Detail" column takes remaining space
            ];


            let t = Table::new(rows, widths)
                .header(header)
                .block(Block::default().borders(Borders::ALL).border_style(content_border_style).title("Task Results"))
                .row_highlight_style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD)); // Use row_highlight_style
            
            f.render_widget(Clear, right_area);
            f.render_widget(t, right_area);
        } else if let Some(msg) = &output.message {
             render_list(f, right_area, "Result Message", vec![msg], 0, content_border_style, is_content_focused);
        } else if let Some(json) = &output.raw_json {
             // Render JSON lines
             let lines: Vec<&str> = json.lines().collect();
             render_list(f, right_area, "Raw JSON Result", lines, 0, content_border_style, is_content_focused);
        }
    } else if app.focus == Focus::Review {
        // Render Review Summary Overlay
        let area = centered_rect(70, 40, f.area());
        
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Yellow))
            .title("⚠️  ACTION REVIEW (PROPOSED CHANGES)");
            
        let mut text = vec![
            Line::from(Span::styled("The following actions will be performed LIVE:", Style::default().add_modifier(Modifier::BOLD))),
            Line::from(""),
        ];

        // If we have a task result (from the silent dry-run), show it
        if let Some(output) = &app.task_output {
            for row in &output.rows {
                let detail = row[1].clone();
                text.push(Line::from(format!(" • {}", detail)));
            }
        } else {
            text.push(Line::from("Preparing action summary..."));
        }

        text.push(Line::from(""));
        text.push(Line::from(Span::styled("PRESS <Enter> TO CONFIRM LIVE EXECUTION", Style::default().fg(Color::Green).add_modifier(Modifier::BOLD))));
        text.push(Line::from(Span::styled("PRESS <Esc> TO CANCEL", Style::default().fg(Color::Red))));

        let paragraph = Paragraph::new(text)
            .block(block)
            .wrap(Wrap { trim: true });
            
        f.render_widget(Clear, area);
        f.render_widget(paragraph, area);
    } else if app.focus == Focus::Input {
        // Render Input Prompt Overlay
        let (prompt_title, prompt_text) = match &app.input_context {
            crate::app::InputContext::OffboardUserEmail => ("Graceful Offboarding (1/2)", "Enter User Email (UPN):"),
            crate::app::InputContext::OffboardManagerEmail { .. } => ("Graceful Offboarding (2/2)", "Enter Manager Email (Optional):"),
            crate::app::InputContext::None => ("Input", "Processing..."),
        };

        let area = centered_rect(60, 20, f.area());
        
        let input_block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Cyan))
            .title(prompt_title);
            
        let input_text = format!("{}\n\n> {}", prompt_text, app.input_buffer);
        let paragraph = Paragraph::new(input_text)
            .block(input_block)
            .wrap(Wrap { trim: false });
            
        f.render_widget(Clear, area);
        f.render_widget(paragraph, area);
    } else {
            match app.current_tab {
                CurrentTab::Security => {
                    // Dynamic Titles based on Dry Run status
                    let shadow_it_title = if app.dry_run {
                        "🕵️  Shadow IT: Governance (Dry Run)"
                    } else {
                        "🔨 Shadow IT: Governance (LIVE REMEDIATION)"
                    };
        
                    let items = vec![
                        shadow_it_title,
                        "🚨 Surgical Lockdown",
                    ];
                    render_list(f, right_area, "Security Modules", items, app.security_index, content_border_style, is_content_focused);
                },
                CurrentTab::IAM => {
        
                let items = vec![
                    "👋 Graceful Offboarding",
                    "🧹 Guest User Cleanup",
                    "🧪 Test Connectivity",
                ];
                render_list(f, right_area, "IAM Modules", items, app.iam_index, content_border_style, is_content_focused);
            },
            CurrentTab::Settings => {
                // Split Right Pane into Info (Top) and Actions (Bottom)
                let settings_chunks = Layout::default()
                    .direction(Direction::Vertical)
                    .constraints([
                        Constraint::Min(1),       // Info Area (Flexible)
                        Constraint::Length(4),    // Actions Area (Fixed: 2 items + 2 borders)
                    ].as_ref())
                    .split(right_area);

                let info_area = settings_chunks[0];
                let actions_area = settings_chunks[1];

                // --- INFO SECTION ---
                let mut info_items = Vec::new();
                let mut title = "Configuration".to_string();

                if let Some(profile) = &app.user_profile {
                    title = format!("Configuration (Logged In: {})", profile.name);
                    let tenant_name = profile.email.split('@').nth(1).unwrap_or("Unknown Domain");

                    info_items.push(ListItem::new(format!("Tenant ID:      {}", profile.tenant_id)));
                    info_items.push(ListItem::new(format!("Tenant Name:    {}", tenant_name)));
                    info_items.push(ListItem::new(format!("Delegate User:  {}", profile.name)));
                    info_items.push(ListItem::new(format!("Auth Date:      {}", profile.last_login)));
                    info_items.push(ListItem::new(""));
                    info_items.push(ListItem::new(Span::styled("Granted Scopes:", Style::default().add_modifier(Modifier::UNDERLINED))));
                    for scope in &profile.scopes {
                        info_items.push(ListItem::new(format!("  - {}", scope)));
                    }
                } else {
                     info_items.push(ListItem::new(format!("Tenant ID:      [{}]", app.tenant_id)));
                     info_items.push(ListItem::new(""));
                     info_items.push(ListItem::new("Please log in to view full context."));
                }

                let info_list = List::new(info_items)
                    .block(Block::default().borders(Borders::ALL).border_style(content_border_style).title(title));
                
                f.render_widget(Clear, info_area);
                f.render_widget(info_list, info_area);

                // --- ACTIONS SECTION ---
                let dry_run_str = if app.dry_run { "Enabled" } else { "Disabled" };
                let action_items = vec![
                    format!("Dry Run:        [{}]", dry_run_str),
                    "🔐 Login / Re-authenticate".to_string(),
                ];

                render_list(f, actions_area, "Actions", action_items, app.settings_index, content_border_style, is_content_focused);
            }
        }
    }

    // --- BOTTOM PANE: Logs / Status ---
    let help_text = if app.focus == Focus::Input {
        " <Enter> Submit | <Esc> Cancel "
    } else if app.task_output.is_some() {
        " <ESC/q> Back | <e> Export CSV "
    } else {
        " <Tab> Switch Focus | <h/j/k/l> Navigate | <Enter> Select | <q> Quit "
    };

    // Get AuthStatus for bottom-right display
    let auth_status_display: Span = match &app.auth_status {
        crate::app::AuthStatus::Unknown => Span::styled("Auth: Unknown", Style::default().fg(Color::DarkGray)),
        crate::app::AuthStatus::Refreshing => Span::styled("Auth: 🔄 Refreshing", Style::default().fg(Color::Cyan)),
        crate::app::AuthStatus::Valid(msg) => Span::styled(format!("Auth: ✅ {}", msg), Style::default().fg(Color::Green)),
        crate::app::AuthStatus::Invalid(msg) => Span::styled(format!("Auth: ❌ {}", msg), Style::default().fg(Color::Red)),
    };
    
    let help_line = Line::from(vec![
        Span::styled(help_text, Style::default().fg(Color::DarkGray)),
        Span::raw("   "), // Spacer
        auth_status_display,
    ]).right_aligned();

    let log_list_with_help = List::new(app.logs.iter().map(|l| ListItem::new(Line::from(Span::raw(l)))).collect::<Vec<_>>())
        .block(Block::default()
            .borders(Borders::ALL)
            .border_style(logs_border_style)
            .title("Logs & Status")
            .title_bottom(help_line)
        )
        .highlight_style(Style::default().bg(Color::DarkGray))
        .style(Style::default().fg(Color::White));

    // Auto-scroll logic:
    if app.focus != Focus::Logs && !app.logs.is_empty() {
        app.logs_state.select(Some(app.logs.len() - 1));
    }
        
    f.render_widget(Clear, bottom_area);
    f.render_stateful_widget(log_list_with_help, bottom_area, &mut app.logs_state);
}
    
fn render_list<S: Into<String>>(
    f: &mut Frame,
    area: ratatui::layout::Rect,
    title: &str,
    items: Vec<S>,
    selected_index: usize,
    border_style: Style,
    is_focused: bool,
) {
    let list_items: Vec<ListItem> = items
        .into_iter()
        .enumerate()
        .map(|(i, item)| {
            let mut style = Style::default();
            if i == selected_index {
                if is_focused {
                    style = style.fg(Color::Black).bg(Color::Cyan).add_modifier(Modifier::BOLD);
                } else {
                    style = style.fg(Color::Cyan); // Just text color if not focused
                }
            }
            ListItem::new(Span::styled(item.into(), style))
        })
        .collect();

    let list = List::new(list_items)
        .block(Block::default().borders(Borders::ALL).border_style(border_style).title(title));

    f.render_widget(Clear, area); // Clear background to prevent artifacts
    f.render_widget(list, area);
}

// Helper for centering rect
fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}

// Helper to get style based on action type
fn get_action_style(action_type: &str) -> Style {
    match action_type {
        "DRY-RUN" => Style::default().fg(Color::LightCyan),
        "SUCCESS" => Style::default().fg(Color::Green),
        "INFO" => Style::default().fg(Color::White),
        "WARNING" => Style::default().fg(Color::Yellow),
        "MANUAL" => Style::default().fg(Color::Magenta),
        "ERROR" => Style::default().fg(Color::Red).add_modifier(Modifier::BOLD),
        _ => Style::default().fg(Color::DarkGray),
    }
}
