use crossterm::event::KeyCode;
use ratatui::widgets::ListState;
use crate::profile::UserProfile;
use crate::runner::TaskOutput;

#[derive(Debug, Copy, Clone, PartialEq)]
pub enum CurrentTab {
    Security,
    IAM,
    Settings,
}

#[derive(Debug, Copy, Clone, PartialEq)]
pub enum Focus {
    Menu,
    Content,
    Logs,
    Input,
    Review,
    Filter, // New focus for live filtering of results
}

#[allow(dead_code)]
pub enum AppAction {
    Login,
    ToggleDryRun,
    RunTask { name: String, args: Vec<String> },
    ReviewProposedActions { name: String, args: Vec<String> },
    ExportResults,
    BackToMenu,
}

#[derive(Debug, Clone, PartialEq)]
pub enum InputContext {
    None,
    OffboardUserEmail,
    OffboardManagerEmail { user_email: String },
    OffboardDeviceAction { user_email: String, manager_email: Option<String> },
    GuestCleanupThreshold,
}

#[derive(Debug, Clone)]
pub enum AuthStatus {
    Unknown,
    Refreshing,
    Valid(String),
    Invalid(String),
}

pub struct App {
    pub current_tab: CurrentTab,
    pub focus: Focus,
    pub should_quit: bool,
    pub logs: Vec<String>,
    pub logs_state: ListState,
    pub is_loading: bool,
    
    // Input State
    pub input_buffer: String,
    pub input_context: InputContext,

    // Review State
    pub pending_action: Option<(String, Vec<String>)>,

    // Navigation State
    pub security_index: usize,
    pub iam_index: usize,
    pub settings_index: usize,

    // Settings State
    pub tenant_id: String,
    pub dry_run: bool,
    pub user_profile: Option<UserProfile>,
    pub auth_status: AuthStatus,

    // Task Results
    pub task_output: Option<TaskOutput>,
    pub show_detail: bool,
    pub selected_row: usize,
    pub results_state: ratatui::widgets::TableState,
    pub filter_buffer: String, // NEW
}

impl App {
    pub fn new() -> Self {
        let user_profile = UserProfile::load();
        let tenant_id = user_profile
            .as_ref()
            .map(|p| p.tenant_id.clone())
            .unwrap_or_else(|| "Not Connected".to_string());

        Self {
            current_tab: CurrentTab::Security,
            focus: Focus::Menu,
            should_quit: false,
            logs: vec!["Welcome to o365-cli".to_string()],
            logs_state: ListState::default(),
            is_loading: false,
            input_buffer: String::new(),
            input_context: InputContext::None,
            pending_action: None,
            security_index: 0,
            iam_index: 0,
            settings_index: 0,
            tenant_id,
            dry_run: true,
            user_profile,
            auth_status: AuthStatus::Unknown,
            task_output: None,
            show_detail: false,
            selected_row: 0,
            results_state: ratatui::widgets::TableState::default(),
            filter_buffer: String::new(),
        }
    }

    pub fn add_log(&mut self, message: String) {
        log::info!("{}", message);
        self.logs.push(message);
    }

    pub fn on_paste(&mut self, data: String) {
        if self.focus == Focus::Input {
            self.input_buffer.push_str(&data);
        }
    }

    pub fn on_key(&mut self, key: KeyCode) -> Option<AppAction> {
        // Handle Filter Mode
        if self.focus == Focus::Filter {
            match key {
                KeyCode::Enter | KeyCode::Esc => {
                    self.focus = Focus::Content;
                    return None;
                }
                KeyCode::Backspace => {
                    self.filter_buffer.pop();
                    self.selected_row = 0; // Reset selection on filter change
                    return None;
                }
                KeyCode::Char(c) => {
                    self.filter_buffer.push(c);
                    self.selected_row = 0;
                    return None;
                }
                _ => return None,
            }
        }

        // Handle Review Mode
        if self.focus == Focus::Review {
            match key {
                // Confirm with Enter or x
                KeyCode::Enter | KeyCode::Char('x') => {
                    if let Some((name, args)) = self.pending_action.take() {
                        self.focus = Focus::Content;
                        return Some(AppAction::RunTask { name, args });
                    }
                }
                KeyCode::Esc | KeyCode::Char('q') => {
                    self.pending_action = None;
                    self.focus = Focus::Content;
                    return None;
                }
                _ => return None,
            }
        }

        // Handle Input Mode
        if self.focus == Focus::Input {
            match key {
                KeyCode::Enter => {
                    let input = self.input_buffer.clone();
                    self.input_buffer.clear();
                    return self.handle_input_submission(input);
                }
                KeyCode::Esc => {
                    self.input_buffer.clear();
                    self.input_context = InputContext::None;
                    self.focus = Focus::Content;
                    return None;
                }
                KeyCode::Backspace => { self.input_buffer.pop(); return None; }
                KeyCode::Char(c) => { self.input_buffer.push(c); return None; }
                _ => return None,
            }
        }

        // Special handling if we are showing results
        if let Some(_output) = &self.task_output {
            if self.show_detail {
                match key {
                    KeyCode::Esc | KeyCode::Char('q') | KeyCode::Enter | KeyCode::Char(' ') => {
                        self.show_detail = false;
                        return None;
                    }
                    _ => return None,
                }
            }

            match key {
                KeyCode::Esc | KeyCode::Backspace | KeyCode::Char('q') => {
                    self.selected_row = 0;
                    self.results_state.select(None);
                    return Some(AppAction::BackToMenu);
                }
                KeyCode::Char('e') | KeyCode::Char('E') => return Some(AppAction::ExportResults),
                KeyCode::Char('/') => {
                    self.focus = Focus::Filter;
                    self.filter_buffer.clear();
                    return None;
                }
                KeyCode::Enter | KeyCode::Char(' ') => {
                    self.show_detail = true;
                    return None;
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    let count = self.get_filtered_rows().len();
                    if self.selected_row < count.saturating_sub(1) {
                        self.selected_row += 1;
                        self.results_state.select(Some(self.selected_row));
                    }
                    return None;
                }
                KeyCode::Up | KeyCode::Char('k') => {
                    if self.selected_row > 0 {
                        self.selected_row -= 1;
                        self.results_state.select(Some(self.selected_row));
                    }
                    return None;
                }
                _ => {} 
            }
        }

        match key {
            KeyCode::Char('q') | KeyCode::Esc => { self.should_quit = true; None },
            KeyCode::Right | KeyCode::Enter | KeyCode::Char('l') if self.focus == Focus::Menu => { self.focus = Focus::Content; None },
            KeyCode::Left | KeyCode::Char('h') if self.focus == Focus::Content => { self.focus = Focus::Menu; None },
            KeyCode::Down | KeyCode::Char('j') if (self.focus == Focus::Menu || self.focus == Focus::Content) => {
                match self.focus {
                    Focus::Menu => self.next_tab(), 
                    Focus::Content => self.move_content_down(), 
                    _ => {}
                }
                None
            },
            KeyCode::Up | KeyCode::Char('k') => {
                match self.focus {
                    Focus::Menu => self.previous_tab(),
                    Focus::Content => self.move_content_up(),
                    _ => {}
                }
                None
            },
            KeyCode::Tab => {
                self.focus = match self.focus {
                    Focus::Menu => Focus::Content,
                    Focus::Content => Focus::Logs,
                    Focus::Logs => Focus::Menu,
                    _ => Focus::Menu,
                };
                None
            },
            KeyCode::Enter | KeyCode::Char(' ') if self.focus == Focus::Content => self.execute_action(),
            KeyCode::Char('1') => { self.current_tab = CurrentTab::Security; self.focus = Focus::Menu; self.task_output = None; None },
            KeyCode::Char('2') => { self.current_tab = CurrentTab::IAM; self.focus = Focus::Menu; self.task_output = None; None },
            KeyCode::Char('3') => { self.current_tab = CurrentTab::Settings; self.focus = Focus::Menu; self.task_output = None; None },
            _ => None,
        }
    }

    fn handle_input_submission(&mut self, input: String) -> Option<AppAction> {
        match self.input_context.clone() {
            InputContext::OffboardUserEmail => {
                if input.trim().is_empty() {
                    self.add_log("❌ Operation cancelled: User email is required.".to_string());
                    self.input_context = InputContext::None;
                    self.focus = Focus::Content;
                    return None;
                }
                let user = input.trim().to_string();
                self.input_context = InputContext::OffboardManagerEmail { user_email: user };
                None
            },
            InputContext::OffboardManagerEmail { user_email } => {
                let manager = if input.trim().is_empty() { None } else { Some(input.trim().to_string()) };
                self.input_context = InputContext::OffboardDeviceAction { user_email, manager_email: manager };
                self.input_buffer.clear();
                self.input_buffer.push_str("retire"); // Default
                None
            },
            InputContext::OffboardDeviceAction { user_email, manager_email } => {
                let device_action = input.trim().to_lowercase();
                self.input_context = InputContext::None;
                self.focus = Focus::Content;
                
                let mut args = vec![
                    "--user".to_string(), user_email, 
                    "--dry-run".to_string(), self.dry_run.to_string(),
                    "--device-action".to_string(), device_action
                ];
                
                if let Some(manager) = manager_email {
                    args.push("--manager".to_string());
                    args.push(manager);
                }

                // If NOT dry run, we MUST review first
                if !self.dry_run {
                    self.pending_action = Some(("iam:offboard".to_string(), args.clone()));
                    self.focus = Focus::Review;
                    return Some(AppAction::ReviewProposedActions { name: "iam:offboard".to_string(), args });
                }

                Some(AppAction::RunTask { 
                    name: "iam:offboard".to_string(), 
                    args 
                })
            },
            InputContext::GuestCleanupThreshold => {
                let threshold = input.trim().parse::<u32>().unwrap_or(90);
                self.input_context = InputContext::None;
                self.focus = Focus::Content;
                
                let args = vec![
                    "--days".to_string(), 
                    threshold.to_string(), 
                    "--dry-run".to_string(), 
                    self.dry_run.to_string()
                ];

                if !self.dry_run {
                    self.pending_action = Some(("iam:guest-cleanup".to_string(), args.clone()));
                    self.focus = Focus::Review;
                    return Some(AppAction::ReviewProposedActions { name: "iam:guest-cleanup".to_string(), args });
                }

                Some(AppAction::RunTask { 
                    name: "iam:guest-cleanup".to_string(), 
                    args 
                })
            }
            _ => { self.focus = Focus::Content; None },
        }
    }

    pub fn next_tab(&mut self) {
        self.current_tab = match self.current_tab {
            CurrentTab::Security => CurrentTab::IAM,
            CurrentTab::IAM => CurrentTab::Settings,
            CurrentTab::Settings => CurrentTab::Security,
        };
        self.task_output = None;
    }

    pub fn previous_tab(&mut self) {
        self.current_tab = match self.current_tab {
            CurrentTab::Security => CurrentTab::Settings,
            CurrentTab::IAM => CurrentTab::Security,
            CurrentTab::Settings => CurrentTab::IAM,
        };
        self.task_output = None;
    }

    fn move_content_up(&mut self) {
        match self.current_tab {
            CurrentTab::Security => if self.security_index > 0 { self.security_index -= 1; },
            CurrentTab::IAM => if self.iam_index > 0 { self.iam_index -= 1; },
            CurrentTab::Settings => if self.settings_index > 0 { self.settings_index -= 1; },
        }
    }

    fn move_content_down(&mut self) {
        match self.current_tab {
            CurrentTab::Security => if self.security_index < 1 { self.security_index += 1; },
            CurrentTab::IAM => if self.iam_index < 2 { self.iam_index += 1; },
            CurrentTab::Settings => if self.settings_index < 1 { self.settings_index += 1; },
        }
    }

    fn execute_action(&mut self) -> Option<AppAction> {
        match self.current_tab {
            CurrentTab::Security => match self.security_index {
                0 => Some(AppAction::RunTask { 
                    name: "sec:shadow-it".to_string(), 
                    args: vec!["--dry-run".to_string(), self.dry_run.to_string()] 
                }),
                _ => None,
            },
            CurrentTab::IAM => match self.iam_index {
                0 => { 
                    self.input_context = InputContext::OffboardUserEmail;
                    self.focus = Focus::Input;
                    self.input_buffer.clear();
                    None 
                },
                1 => {
                    self.input_context = InputContext::GuestCleanupThreshold;
                    self.focus = Focus::Input;
                    self.input_buffer.clear();
                    self.input_buffer.push_str("90"); // Default
                    None
                },
                2 => { 
                    self.input_context = InputContext::OffboardUserEmail;
                    self.focus = Focus::Input;
                    self.input_buffer.clear();
                    None 
                },
                _ => None,
            },
            CurrentTab::Settings => match self.settings_index {
                0 => { self.dry_run = !self.dry_run; Some(AppAction::ToggleDryRun) },
                1 => Some(AppAction::Login),
                _ => None,
            }
        }
    }

    pub fn on_tick(&mut self) {}

    pub fn get_filtered_rows(&self) -> Vec<Vec<String>> {
        if let Some(output) = &self.task_output {
            if self.filter_buffer.is_empty() {
                return output.rows.clone();
            }
            let query = self.filter_buffer.to_lowercase();
            output.rows.iter()
                .filter(|row| {
                    row.iter().any(|col| col.to_lowercase().contains(&query))
                })
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_offboarding_input_flow() {
        let mut app = App::new();
        app.focus = Focus::Input;
        app.input_context = InputContext::OffboardUserEmail;
        
        let action = app.handle_input_submission("user@test.com".to_string());
        assert!(action.is_none());
        assert_eq!(app.input_context, InputContext::OffboardManagerEmail { user_email: "user@test.com".to_string() });

        let action = app.handle_input_submission("".to_string());
        match action {
            Some(AppAction::RunTask { .. }) => {},
            _ => panic!("Expected RunTask for dry run"),
        }
    }

    #[test]
    fn test_review_confirmation_flow_required_for_live() {
        let mut app = App::new();
        app.dry_run = false; // LIVE MODE
        app.input_context = InputContext::OffboardManagerEmail { user_email: "target@test.com".to_string() };

        // Submit manager email
        let action = app.handle_input_submission("manager@test.com".to_string());

        // Should return ReviewProposedActions
        match action {
            Some(AppAction::ReviewProposedActions { .. }) => {},
            _ => panic!("Expected ReviewProposedActions action for live execution"),
        }
        assert_eq!(app.focus, Focus::Review);
        assert!(app.pending_action.is_some());
    }

    #[test]
    fn test_guest_cleanup_input_flow() {
        let mut app = App::new();
        app.focus = Focus::Input;
        app.input_context = InputContext::GuestCleanupThreshold;
        
        let action = app.handle_input_submission("120".to_string());
        match action {
            Some(AppAction::RunTask { name, args }) => {
                assert_eq!(name, "iam:guest-cleanup");
                assert!(args.contains(&"--days".to_string()));
                assert!(args.contains(&"120".to_string()));
            },
            _ => panic!("Expected RunTask for guest cleanup"),
        }
    }

    #[test]
    fn test_results_filtering_logic() {
        let mut app = App::new();
        let output = TaskOutput {
            headers: vec!["Col1".to_string(), "Col2".to_string()],
            rows: vec![
                vec!["Apple".to_string(), "Fruit".to_string()],
                vec!["Banana".to_string(), "Fruit".to_string()],
                vec!["Carrot".to_string(), "Veggie".to_string()],
            ],
            raw_json: None,
            message: None,
            file_path: None,
        };
        app.task_output = Some(output);

        // No filter
        assert_eq!(app.get_filtered_rows().len(), 3);

        // Filter by content
        app.filter_buffer = "apple".to_string();
        assert_eq!(app.get_filtered_rows().len(), 1);
        assert_eq!(app.get_filtered_rows()[0][0], "Apple");

        // Case insensitive
        app.filter_buffer = "FRUIT".to_string();
        assert_eq!(app.get_filtered_rows().len(), 2);

        // No match
        app.filter_buffer = "Zebra".to_string();
        assert_eq!(app.get_filtered_rows().len(), 0);
    }
}
