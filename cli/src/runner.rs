use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
#[serde(rename_all = "lowercase")]
enum IpcMessage {
    Progress { message: String, percent: u8 },
    Success { data: serde_json::Value },
    Error { message: String },
}

#[derive(Debug, Clone)]
pub struct TaskOutput {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub raw_json: Option<String>,
    pub message: Option<String>,
    pub file_path: Option<String>,
}

pub fn run_task<F>(task_name: &str, args: &[String], token: &str, mut on_progress: F) -> Result<TaskOutput> 
where F: FnMut(String) {
    // Prepare Worker Path
    let current_dir = std::env::current_dir()?;
    let root_dir = if current_dir.ends_with("cli") {
        current_dir.parent().unwrap().to_path_buf()
    } else {
        current_dir
    };
    let core_script = root_dir.join("core/src/index.ts");

    on_progress(format!("🚀 Spawning Worker for task: {}", task_name));

    // Spawn Bun with stdin pipe for secure token passing
    let mut command = Command::new("bun");
    command
        .arg("run")
        .arg(core_script)
        .arg(task_name)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command.spawn().context("Failed to start Bun process")?;
    
    // Write token to stdin and close the pipe
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(token.as_bytes())
            .context("Failed to write token to worker stdin")?;
        stdin.write_all(b"\n")
            .context("Failed to write newline to worker stdin")?;
        // stdin is dropped here, closing the pipe
    }
    
    let stdout = child.stdout.take().context("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);

    let mut output = TaskOutput {
        headers: Vec::new(),
        rows: Vec::new(),
        raw_json: None,
        message: None,
        file_path: None,
    };

    // Process Output
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() { continue; }

        match serde_json::from_str::<IpcMessage>(&line) {
            Ok(msg) => match msg {
                IpcMessage::Progress { message, percent } => {
                    on_progress(format!("⏳ [{:02}%] {}", percent, message));
                }
                IpcMessage::Success { data } => {
                    // Check for Table format
                    if let Some(table_data) = data.get("table") {
                        if let Some(headers) = table_data.get("headers").and_then(|h| h.as_array()) {
                            output.headers = headers.iter().map(|v| v.as_str().unwrap_or("").to_string()).collect();
                        }
                        
                        if let Some(rows) = table_data.get("rows").and_then(|r| r.as_array()) {
                            for row in rows {
                                if let Some(cols) = row.as_array() {
                                    let col_row: Vec<String> = cols.iter().map(|v| v.as_str().unwrap_or("").to_string()).collect();
                                    output.rows.push(col_row);
                                }
                            }
                        }
                        
                        if let Some(msg) = data.get("message").and_then(|m| m.as_str()) {
                            output.message = Some(msg.to_string());
                        }
                        if let Some(file) = data.get("file_path").and_then(|f| f.as_str()) {
                            output.file_path = Some(file.to_string());
                        }
                    } else {
                        // Fallback to JSON
                        output.raw_json = Some(serde_json::to_string_pretty(&data)?);
                    }
                }
                IpcMessage::Error { message } => {
                    return Err(anyhow::anyhow!("Worker Error: {}", message));
                }
            },
            Err(_) => on_progress(format!("📝 {}", line)),
        }
    }

    let status = child.wait()?;
    if !status.success() {
        return Err(anyhow::anyhow!("Worker failed with exit code: {:?}", status.code()));
    }

    Ok(output)
}
