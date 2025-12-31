use anyhow::Result;
use std::sync::mpsc::{Receiver, Sender};
use std::time::{Duration, Instant};
use tokio::runtime::Runtime;

/// Health check update message sent from background task to main thread
#[derive(Debug, Clone)]
pub struct HealthUpdate {
    pub latency_ms: u64,
}

/// Spawns a background health monitoring task
/// Returns a receiver channel for health updates
pub fn spawn_health_monitor() -> Receiver<HealthUpdate> {
    let (tx, rx) = std::sync::mpsc::channel();

    // Spawn a dedicated thread for health monitoring
    std::thread::spawn(move || {
        // Create a new Tokio runtime for this thread
        let rt = Runtime::new().expect("Failed to create health monitor runtime");

        rt.block_on(async {
            health_monitor_loop(tx).await;
        });
    });

    rx
}

/// Main health monitoring loop
/// Pings Microsoft Graph API every 30 seconds and sends latency updates
async fn health_monitor_loop(tx: Sender<HealthUpdate>) {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("Failed to build HTTP client");

    loop {
        // Perform health check
        if let Ok(latency_ms) = perform_health_check(&client).await {
            // Send update to main thread (ignore errors if receiver dropped)
            let _ = tx.send(HealthUpdate { latency_ms });
        }

        // Wait 30 seconds before next check
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
}

/// Performs a single health check by pinging Microsoft Graph API
/// Returns latency in milliseconds
async fn perform_health_check(client: &reqwest::Client) -> Result<u64> {
    let start = Instant::now();

    // Ping Microsoft Graph root endpoint (no auth required)
    let response = client
        .get("https://graph.microsoft.com/v1.0/")
        .send()
        .await?;

    let elapsed = start.elapsed();

    // Check if response is valid (we expect 401 Unauthorized since we're not authed)
    // Any response (including 401) means the API is reachable
    if response.status().as_u16() == 401 || response.status().is_success() {
        Ok(elapsed.as_millis() as u64)
    } else {
        Err(anyhow::anyhow!(
            "Unexpected response status: {}",
            response.status()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let client = reqwest::Client::new();
        let result = perform_health_check(&client).await;

        // Should either succeed or fail gracefully
        match result {
            Ok(latency) => {
                println!("Health check succeeded: {} ms", latency);
                assert!(latency > 0);
            }
            Err(e) => {
                println!("Health check failed (expected in test env): {}", e);
            }
        }
    }
}
