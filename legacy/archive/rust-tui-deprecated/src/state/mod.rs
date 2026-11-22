// State management modules
// Replaces the monolithic app.rs with clean separation of concerns

pub mod app_state;
pub mod navigation;
pub mod config;
pub mod health;

// Re-export main types for convenience
pub use app_state::{AppState, FocusState, ModalState, ConfirmAction, AuthStatus, LoginStage};
pub use navigation::NavigationState;
pub use config::ConfigState;
pub use health::{HealthMetrics, Environment, HealthStatus};
