pub enum CurrentTab {
    Security,
    IAM,
    Settings,
}

pub struct App {
    pub current_tab: CurrentTab,
    pub should_quit: bool,
    pub logs: Vec<String>,
}

impl App {
    pub fn new() -> Self {
        Self {
            current_tab: CurrentTab::Security,
            should_quit: false,
            logs: vec!["Welcome to Office 365 Toolset".to_string()],
        }
    }

    pub fn on_key(&mut self, c: char) {
        match c {
            'q' => self.should_quit = true,
            '1' => self.current_tab = CurrentTab::Security,
            '2' => self.current_tab = CurrentTab::IAM,
            '3' => self.current_tab = CurrentTab::Settings,
            _ => {}
        }
    }

    pub fn on_tick(&mut self) {
        // Logic to handle background updates will go here
    }
}
