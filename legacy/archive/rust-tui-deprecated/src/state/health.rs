use chrono::{DateTime, Utc};

/// System health monitoring metrics
#[derive(Debug, Clone)]
pub struct HealthMetrics {
    pub api_latency_ms: Option<u64>,
    pub last_health_check: Option<DateTime<Utc>>,
    pub environment: Environment,
    pub version: String,
    pub health_status: HealthStatus,
}

/// Deployment environment detection
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Production,   // *.onmicrosoft.com tenants
    Development,  // dev/test in tenant ID
    Test,
}

/// API health status based on latency thresholds
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,      // < 500ms
    Degraded,     // 500-2000ms
    Unhealthy,    // > 2000ms
    Unknown,      // No health check performed yet
}

impl HealthMetrics {
    /// Create new HealthMetrics with defaults
    pub fn new() -> Self {
        Self {
            api_latency_ms: None,
            last_health_check: None,
            environment: Environment::Production,
            version: env!("CARGO_PKG_VERSION").to_string(),
            health_status: HealthStatus::Unknown,
        }
    }

    /// Detect environment from tenant ID
    pub fn detect_environment(&mut self, tenant_id: &str) {
        self.environment = if tenant_id.ends_with(".onmicrosoft.com") {
            Environment::Production
        } else if tenant_id.contains("test") || tenant_id.contains("dev") {
            Environment::Test
        } else {
            Environment::Development
        };
    }

    /// Update latency and recalculate health status
    pub fn update_latency(&mut self, latency_ms: u64) {
        self.api_latency_ms = Some(latency_ms);
        self.last_health_check = Some(Utc::now());

        self.health_status = if latency_ms < 500 {
            HealthStatus::Healthy
        } else if latency_ms < 2000 {
            HealthStatus::Degraded
        } else {
            HealthStatus::Unhealthy
        };
    }

    /// Get formatted latency string
    pub fn latency_string(&self) -> String {
        match self.api_latency_ms {
            Some(ms) => format!("{} ms", ms),
            None => "Unknown".to_string(),
        }
    }

    /// Get health status icon
    pub fn status_icon(&self) -> &'static str {
        match self.health_status {
            HealthStatus::Healthy => "✅",
            HealthStatus::Degraded => "⚠️",
            HealthStatus::Unhealthy => "❌",
            HealthStatus::Unknown => "❓",
        }
    }
}

impl Default for HealthMetrics {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for Environment {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Environment::Production => write!(f, "Production"),
            Environment::Development => write!(f, "Development"),
            Environment::Test => write!(f, "Test"),
        }
    }
}

impl std::fmt::Display for HealthStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HealthStatus::Healthy => write!(f, "Healthy"),
            HealthStatus::Degraded => write!(f, "Degraded"),
            HealthStatus::Unhealthy => write!(f, "Unhealthy"),
            HealthStatus::Unknown => write!(f, "Unknown"),
        }
    }
}
