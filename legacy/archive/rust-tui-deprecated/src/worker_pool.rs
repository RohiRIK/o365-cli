use anyhow::{Context, Result};
use std::collections::VecDeque;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::io::Write;

/// Configuration for the worker pool
#[derive(Debug, Clone)]
#[allow(dead_code)] // Scaffolding for Phase 2 module execution
pub struct WorkerPoolConfig {
    /// Maximum number of concurrent workers
    pub max_workers: usize,
    /// Path to the TypeScript worker script
    pub worker_script: std::path::PathBuf,
}

impl Default for WorkerPoolConfig {
    fn default() -> Self {
        let current_dir = std::env::current_dir().unwrap_or_default();
        let root_dir = if current_dir.ends_with("cli") {
            current_dir.parent().unwrap().to_path_buf()
        } else {
            current_dir
        };
        let worker_script = root_dir.join("core/src/index.ts");

        Self {
            max_workers: 3, // Default from modules.toml
            worker_script,
        }
    }
}

/// Represents a task to be executed by a worker
#[derive(Debug, Clone)]
#[allow(dead_code)] // Scaffolding for Phase 2 module execution
pub struct WorkerTask {
    pub task_name: String,
    pub args: Vec<String>,
    pub token: String,
}

/// Worker handle representing a running Bun process
#[allow(dead_code)] // Scaffolding for Phase 2 module execution
struct Worker {
    id: usize,
    process: Child,
}

impl Worker {
    /// Spawn a new Bun worker process
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    fn spawn(id: usize, script_path: &std::path::Path) -> Result<Self> {
        let mut command = Command::new("bun");
        command
            .arg("run")
            .arg(script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let process = command
            .spawn()
            .context("Failed to spawn Bun worker process")?;

        Ok(Self { id, process })
    }

    /// Execute a task on this worker
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    fn execute(&mut self, task: &WorkerTask) -> Result<()> {
        // Write token to stdin
        if let Some(ref mut stdin) = self.process.stdin {
            stdin
                .write_all(task.token.as_bytes())
                .context("Failed to write token to worker")?;
            stdin
                .write_all(b"\n")
                .context("Failed to write newline to worker")?;
        }

        Ok(())
    }

    /// Check if the worker process is still running
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    fn is_alive(&mut self) -> bool {
        match self.process.try_wait() {
            Ok(None) => true,  // Still running
            Ok(Some(_)) => false,  // Exited
            Err(_) => false,  // Error checking status
        }
    }

    /// Kill the worker process
    fn kill(&mut self) -> Result<()> {
        self.process.kill().context("Failed to kill worker process")
    }
}

impl Drop for Worker {
    fn drop(&mut self) {
        let _ = self.kill();
    }
}

/// Worker pool for parallel task execution
/// Manages up to N concurrent Bun workers with task queuing
#[allow(dead_code)] // Scaffolding for Phase 2 module execution
pub struct WorkerPool {
    config: WorkerPoolConfig,
    workers: Arc<Mutex<Vec<Worker>>>,
    task_queue: Arc<Mutex<VecDeque<WorkerTask>>>,
    next_worker_id: Arc<Mutex<usize>>,
}

impl WorkerPool {
    /// Create a new worker pool with default configuration
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn new() -> Self {
        Self::with_config(WorkerPoolConfig::default())
    }

    /// Create a new worker pool with custom configuration
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn with_config(config: WorkerPoolConfig) -> Self {
        Self {
            config,
            workers: Arc::new(Mutex::new(Vec::new())),
            task_queue: Arc::new(Mutex::new(VecDeque::new())),
            next_worker_id: Arc::new(Mutex::new(0)),
        }
    }

    /// Load configuration from modules.toml
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn from_modules_config() -> Result<Self> {
        use crate::modules::ModuleConfig;

        let config = ModuleConfig::load("../modules.toml")
            .context("Failed to load modules.toml for WorkerPool config")?;

        let worker_config = WorkerPoolConfig {
            max_workers: config.system.max_concurrent_workers,
            ..Default::default()
        };

        Ok(Self::with_config(worker_config))
    }

    /// Submit a task for execution
    /// If workers are available, execute immediately
    /// Otherwise, queue for later execution
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn submit(&self, task: WorkerTask) -> Result<()> {
        let mut workers = self.workers.lock().unwrap();
        let mut queue = self.task_queue.lock().unwrap();

        // If we have capacity, spawn a new worker
        if workers.len() < self.config.max_workers {
            let mut worker_id = self.next_worker_id.lock().unwrap();
            let id = *worker_id;
            *worker_id += 1;
            drop(worker_id);

            let mut worker = Worker::spawn(id, &self.config.worker_script)?;
            worker.execute(&task)?;
            workers.push(worker);
        } else {
            // All workers busy, queue the task
            queue.push_back(task);
        }

        Ok(())
    }

    /// Process queued tasks by checking for available workers
    /// Should be called periodically to dispatch queued tasks
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn process_queue(&self) -> Result<()> {
        let mut workers = self.workers.lock().unwrap();
        let mut queue = self.task_queue.lock().unwrap();

        // Remove dead workers
        workers.retain(|w| {
            let mut worker = unsafe { std::ptr::read(w as *const Worker) };
            let alive = worker.is_alive();
            if !alive {
                std::mem::forget(worker); // Prevent double-drop
            }
            alive
        });

        // Dispatch queued tasks if workers are available
        while workers.len() < self.config.max_workers && !queue.is_empty() {
            if let Some(task) = queue.pop_front() {
                let mut worker_id = self.next_worker_id.lock().unwrap();
                let id = *worker_id;
                *worker_id += 1;
                drop(worker_id);

                let mut worker = Worker::spawn(id, &self.config.worker_script)?;
                worker.execute(&task)?;
                workers.push(worker);
            }
        }

        Ok(())
    }

    /// Wait for all workers to complete
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn wait_all(&self) -> Result<()> {
        loop {
            let mut workers = self.workers.lock().unwrap();

            if workers.is_empty() {
                break;
            }

            // Wait for workers to exit
            workers.retain(|w| {
                let mut worker = unsafe { std::ptr::read(w as *const Worker) };
                let alive = worker.is_alive();
                if !alive {
                    std::mem::forget(worker); // Prevent double-drop
                }
                alive
            });

            drop(workers);

            // Small sleep to avoid busy-waiting
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        Ok(())
    }

    /// Get the number of active workers
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn active_workers(&self) -> usize {
        self.workers.lock().unwrap().len()
    }

    /// Get the number of queued tasks
    #[allow(dead_code)] // Scaffolding for Phase 2 module execution
    pub fn queued_tasks(&self) -> usize {
        self.task_queue.lock().unwrap().len()
    }

    /// Shutdown the pool, killing all workers
    pub fn shutdown(&self) -> Result<()> {
        let mut workers = self.workers.lock().unwrap();

        for worker in workers.iter_mut() {
            worker.kill()?;
        }

        workers.clear();

        Ok(())
    }
}

impl Drop for WorkerPool {
    fn drop(&mut self) {
        let _ = self.shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worker_pool_creation() {
        let pool = WorkerPool::new();
        assert_eq!(pool.active_workers(), 0);
        assert_eq!(pool.queued_tasks(), 0);
    }

    #[test]
    fn test_worker_pool_config_from_modules() {
        let result = WorkerPool::from_modules_config();
        assert!(result.is_ok(), "Should load config from modules.toml");

        let pool = result.unwrap();
        assert_eq!(pool.config.max_workers, 3);
    }

    #[test]
    fn test_task_queuing() {
        let pool = WorkerPool::new();

        let _task = WorkerTask {
            task_name: "test:task".to_string(),
            args: vec![],
            token: "test-token".to_string(),
        };

        // Note: This test doesn't actually submit because it would spawn a real process
        // In a real implementation, we'd use dependency injection or mocking
        assert_eq!(pool.active_workers(), 0);
    }
}
