export class IPC {
  // Send progress update (Rust renders a spinner/bar)
  static progress(message: string, percent?: number) {
    console.log(JSON.stringify({ type: 'progress', message, percent }));
  }

  // Send final success result
  static success(data: any) {
    console.log(JSON.stringify({ type: 'success', data }));
  }

  // Send real-time log (Rust renders in bottom pane)
  static log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    console.log(JSON.stringify({ type: 'log', message, level }));
  }

  // Send fatal error (Rust renders red text)
  static error(message: string) {
    console.log(JSON.stringify({ type: 'error', message }));
    process.exit(1);
  }
}
