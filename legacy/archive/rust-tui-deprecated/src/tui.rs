use crossterm::{
    event::{self, Event},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::Backend, Terminal};
use ratatui::prelude::CrosstermBackend;
use std::{io::{self, Stdout}, sync::mpsc::Receiver, time::{Duration, Instant}};
use crate::state::AppState;
use crate::health_monitor::HealthUpdate;

// Define a type alias for the Terminal
pub type Tui = Terminal<CrosstermBackend<Stdout>>;

pub fn init() -> Result<Tui, anyhow::Error> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, event::EnableBracketedPaste)?;
    let backend = CrosstermBackend::new(stdout);
    let terminal = Terminal::new(backend)?;
    Ok(terminal)
}

pub fn restore() -> Result<(), anyhow::Error> {
    disable_raw_mode()?;
    execute!(io::stdout(), LeaveAlternateScreen, event::DisableBracketedPaste)?;
    Ok(())
}

pub async fn run_app<B: Backend>(
    terminal: &mut Terminal<B>,
    mut app: AppState,
    health_rx: Receiver<HealthUpdate>,
) -> Result<(), anyhow::Error> {
    // TODO: Add session verification logic here
    // For now, just run the event loop

    let tick_rate = Duration::from_millis(250);
    let mut last_tick = Instant::now();

    loop {
        // Check for health updates from background monitor
        if let Ok(health_update) = health_rx.try_recv() {
            app.update_health(health_update.latency_ms);
        }

        // Check for login updates from background login handler
        app.check_login_updates();

        // Render the UI
        terminal.draw(|f| crate::ui::render(f, &app))?;

        // Handle input events
        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        if crossterm::event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                // Handle key input via AppState::on_key
                app.on_key(key.code);
            }
        }

        // Tick for animations and countdown updates
        if last_tick.elapsed() >= tick_rate {
            app.on_tick();
            last_tick = Instant::now();
        }

        // Check if should quit
        if app.should_quit {
            return Ok(());
        }
    }
}
