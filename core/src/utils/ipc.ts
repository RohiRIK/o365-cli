/**
 * IPC Protocol v1.0
 * All messages include a version field for protocol compatibility checking
 */
export class IPC {
  private static readonly VERSION = "1.0";

  // Send progress update (Rust renders a spinner/bar)
  static progress(message: string, percent?: number) {
    console.log(JSON.stringify({
      type: 'progress',
      version: this.VERSION,
      message,
      percent
    }));
  }

  // Send final success result
  static success(data: any) {
    console.log(JSON.stringify({
      type: 'success',
      version: this.VERSION,
      data
    }));
  }

  // Send real-time log (Rust renders in bottom pane)
  static log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    console.log(JSON.stringify({
      type: 'log',
      version: this.VERSION,
      message,
      level
    }));
  }

  // Send fatal error (Rust renders red text)
  static error(message: string) {
    console.log(JSON.stringify({
      type: 'error',
      version: this.VERSION,
      message
    }));
    process.exit(1);
  }

  // Get current protocol version
  static getVersion(): string {
    return this.VERSION;
  }
}
