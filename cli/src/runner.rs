use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use comfy_table::{Table, ContentArrangement};
use comfy_table::presets::UTF8_FULL;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
#[serde(rename_all = "lowercase")]
enum IpcMessage {
    Progress { message: String, percent: u8 },
    Success { data: serde_json::Value },
    Error { message: String },
}

pub fn run_task(task_name: &str, args: &[String], token: &str) -> Result<()> {
    // Prepare Worker Path
    let current_dir = std::env::current_dir()?;
    let root_dir = if current_dir.ends_with("cli") {
        current_dir.parent().unwrap().to_path_buf()
    } else {
        current_dir
    };
    let core_script = root_dir.join("core/src/index.ts");

    println!("🚀 Spawning Worker for task: {}", task_name);

    // Spawn Bun
    let mut command = Command::new("bun");
    command
        .arg("run")
        .arg(core_script)
        .arg(task_name)
        .args(args)
        .env("GRAPH_TOKEN", token)
        .stdout(Stdio::piped());

    let mut child = command.spawn().context("Failed to start Bun process")?;
    let stdout = child.stdout.take().context("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);

    // Process Output
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() { continue; }

        match serde_json::from_str::<IpcMessage>(&line) {
            Ok(msg) => match msg {
                IpcMessage::Progress { message, percent } => {
                    println!("⏳ [{:02}%] {}", percent, message);
                }
                IpcMessage::Success { data } => {
                    // Check for Table format
                    if let Some(table_data) = data.get("table") {
                        let mut table = Table::new();
                        table
                            .load_preset(UTF8_FULL)
                            .set_content_arrangement(ContentArrangement::Dynamic);
                        
                        if let Some(headers) = table_data.get("headers").and_then(|h| h.as_array()) {
                            let header_row: Vec<String> = headers.iter().map(|v| v.as_str().unwrap_or("").to_string()).collect();
                            table.set_header(header_row);
                        }
                        
                        if let Some(rows) = table_data.get("rows").and_then(|r| r.as_array()) {
                            for row in rows {
                                if let Some(cols) = row.as_array() {
                                    let col_row: Vec<String> = cols.iter().map(|v| v.as_str().unwrap_or("").to_string()).collect();
                                    table.add_row(col_row);
                                }
                            }
                        }
                        println!("{}", table);
                        
                        // Print generic message if available
                        if let Some(msg) = data.get("message").and_then(|m| m.as_str()) {
                                println!("\n✅ {}", msg);
                        }
                        if let Some(file) = data.get("file_path").and_then(|f| f.as_str()) {
                                println!("📂 Report saved to: {}", file);
                        }
                    } else {
                        // Fallback to JSON
                        println!("✅ {}", serde_json::to_string_pretty(&data)?);
                    }
                }
                IpcMessage::Error { message } => {
                    eprintln!("❌ Error: {}", message);
                }
            },
            Err(_) => println!("📝 {}", line),
        }
    }

    let status = child.wait()?;
    if !status.success() {
        eprintln!("⚠️ Worker failed with exit code: {:?}", status.code());
    }

    Ok(())
}
