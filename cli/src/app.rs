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
}

#[allow(dead_code)] // Variants are constructed conditionally
pub enum AppAction {
    Login,
    ToggleDryRun,
    RunTask { name: String, args: Vec<String> },
    ExportResults,
    BackToMenu,
}

#[derive(Debug, Clone)]
pub enum AuthStatus {
    Unknown,
    Checking,
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
    
    // Navigation State
    pub security_index: usize,
    pub iam_index: usize,
    pub settings_index: usize,

    // Settings State
    pub tenant_id: String, // Display only
    pub dry_run: bool,
    pub user_profile: Option<UserProfile>,
    pub auth_status: AuthStatus,

    // Task Results
    pub task_output: Option<TaskOutput>,
}

impl App {
    pub fn new() -> Self {
        let user_profile = UserProfile::load();
        let logs = if user_profile.is_some() {
            vec![
                "Welcome to Office 365 Toolset".to_string(),
                "Loaded existing user profile.".to_string(),
            ]
        } else {
            vec![
                "Welcome to Office 365 Toolset".to_string(),
                "Initializing TUI...".to_string(),
            ]
        };

        Self {
            current_tab: CurrentTab::Security,
            focus: Focus::Menu,
            should_quit: false,
            logs,
            logs_state: ListState::default(),
            is_loading: false,
            auth_status: AuthStatus::Unknown,
            security_index: 0,
            iam_index: 0,
            settings_index: 0,
            tenant_id: "Not Connected".to_string(),
            dry_run: true,
            user_profile,
            task_output: None,
        }
    }

    pub fn add_log(&mut self, message: String) {
        log::info!("{}", message);
        self.logs.push(message);
    }

    pub fn on_key(&mut self, key: KeyCode) -> Option<AppAction> {
        // Special handling if we are showing results
        if self.task_output.is_some() {
            match key {
                KeyCode::Esc | KeyCode::Backspace | KeyCode::Char('q') => {
                    return Some(AppAction::BackToMenu);
                }
                KeyCode::Char('e') | KeyCode::Char('E') => {
                    return Some(AppAction::ExportResults);
                }
                // Allow tab navigation to still work to switch contexts
                KeyCode::Tab | KeyCode::Char('1') | KeyCode::Char('2') | KeyCode::Char('3') => {
                    // Fall through to standard navigation which will clear output via next_tab logic
                } 
                _ => return None, // Ignore other keys while in result view (or implement table scrolling)
            }
        }

        match key {
            KeyCode::Char('q') | KeyCode::Esc => {
                self.should_quit = true;
                None
            },
            
            // Focus Switching (Horizontal)
            KeyCode::Right | KeyCode::Enter | KeyCode::Char('l') if self.focus == Focus::Menu => {
                self.focus = Focus::Content;
                None
            },
            KeyCode::Left | KeyCode::Char('h') if self.focus == Focus::Content => {
                self.focus = Focus::Menu;
                None
            },

            // Focus Switching (Vertical)
            KeyCode::Down | KeyCode::Char('j') if (self.focus == Focus::Menu || self.focus == Focus::Content) => {
                match self.focus {
                    Focus::Menu => self.next_tab(), 
                    Focus::Content => self.move_content_down(), 
                    Focus::Logs => self.scroll_logs_down(),
                }
                None
            },
            KeyCode::Up | KeyCode::Char('k') => {
                match self.focus {
                    Focus::Menu => self.previous_tab(),
                    Focus::Content => self.move_content_up(),
                    Focus::Logs => self.scroll_logs_up(),
                }
                None
            },

            // Tab Cycling
            KeyCode::Tab => {
                self.focus = match self.focus {
                    Focus::Menu => Focus::Content,
                    Focus::Content => Focus::Logs,
                    Focus::Logs => Focus::Menu,
                };
                None
            },
            KeyCode::BackTab => {
                self.focus = match self.focus {
                    Focus::Menu => Focus::Logs,
                    Focus::Content => Focus::Menu,
                    Focus::Logs => Focus::Content,
                };
                None
            },

            // Actions (Only in Content)
            KeyCode::Enter | KeyCode::Char(' ') if self.focus == Focus::Content => self.execute_action(),

            // Direct Tab Hotkeys (Always work)
            KeyCode::Char('1') => { self.current_tab = CurrentTab::Security; self.focus = Focus::Menu; self.task_output = None; None },
            KeyCode::Char('2') => { self.current_tab = CurrentTab::IAM; self.focus = Focus::Menu; self.task_output = None; None },
            KeyCode::Char('3') => { self.current_tab = CurrentTab::Settings; self.focus = Focus::Menu; self.task_output = None; None },
            
            _ => None,
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
            CurrentTab::Security => {
                if self.security_index > 0 { self.security_index -= 1; }
            }
            CurrentTab::IAM => {
                if self.iam_index > 0 { self.iam_index -= 1; }
            }
            CurrentTab::Settings => {
                if self.settings_index > 0 { self.settings_index -= 1; }
            }
        }
    }

    fn move_content_down(&mut self) {
        match self.current_tab {
            CurrentTab::Security => {
                if self.security_index < 1 { self.security_index += 1; } // 2 items: Shadow IT, Lockdown
            }
            CurrentTab::IAM => {
                if self.iam_index < 2 { self.iam_index += 1; } // 3 items
            }
            CurrentTab::Settings => {
                // Only 2 actionable items: Dry Run, Login
                if self.settings_index < 1 { self.settings_index += 1; }
            }
        }
    }

    fn scroll_logs_up(&mut self) {
        let i = match self.logs_state.selected() {
            Some(i) => if i > 0 { i - 1 } else { 0 },
            None => if !self.logs.is_empty() { self.logs.len() - 1 } else { 0 },
        };
        self.logs_state.select(Some(i));
    }

    fn scroll_logs_down(&mut self) {
        let i = match self.logs_state.selected() {
            Some(i) => if i < self.logs.len().saturating_sub(1) { i + 1 } else { i },
            None => 0,
        };
        self.logs_state.select(Some(i));
    }

    fn execute_action(&mut self) -> Option<AppAction> {
        match self.current_tab {
            CurrentTab::Security => match self.security_index {
                0 => { 
                    // Merged Shadow IT Action
                    let action_desc = if self.dry_run { "Audit (Dry Run)" } else { "Remediation (LIVE)" };
                    self.add_log(format!("Queueing: Shadow IT {}...", action_desc));
                    
                    Some(AppAction::RunTask { 
                        name: "sec:shadow-it".to_string(), 
                        args: vec!["--dry-run".to_string(), self.dry_run.to_string()] 
                    })
                },
                1 => { 
                    self.add_log("Not Implemented: Surgical Lockdown".to_string());
                    None 
                },
                _ => None,
            },
            CurrentTab::IAM => match self.iam_index {
                0 => { 
                    self.add_log("Not Implemented: Graceful Offboarding".to_string());
                    None
                },
                1 => { 
                    self.add_log("Not Implemented: Guest User Cleanup".to_string());
                    None 
                },
                2 => { 
                    self.add_log("Queueing: Test Connectivity...".to_string());
                    Some(AppAction::RunTask { 
                        name: "iam:test".to_string(), 
                        args: vec![] 
                    })
                },
                _ => None,
            },
            CurrentTab::Settings => match self.settings_index {
                0 => {
                     self.dry_run = !self.dry_run;
                     self.add_log(format!("Action: Dry Run set to {}", self.dry_run));
                     Some(AppAction::ToggleDryRun)
                },
                1 => {
                     Some(AppAction::Login)
                },
                _ => None,
            }
        }
    }

    pub fn on_tick(&mut self) {
        // Logic to handle background updates will go here
    }
}
