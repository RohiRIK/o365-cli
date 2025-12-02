import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import { IPC } from "../utils/ipc";
import * as fs from "fs";

export class GraphService {
  private static instance: Client;
  private static token: string | null = null;

  // Read token from stdin (passed securely by Rust)
  private static async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    // Try stdin first (secure method)
    if (!process.stdin.isTTY) {
      try {
        const stdinData = fs.readFileSync(0, "utf-8").trim();
        if (stdinData) {
          this.token = stdinData;
          return this.token;
        }
      } catch (err) {
        // Fall through to env var
      }
    }

    // Fallback to environment variable (for backwards compatibility)
    const envToken = process.env.GRAPH_TOKEN;
    if (envToken) {
      this.token = envToken;
      return this.token;
    }

    IPC.error("No authentication token found. Expected token from stdin or GRAPH_TOKEN env var.");
    process.exit(1);
  }

  public static getClient(): Client {
    if (!this.instance) {
      // Synchronously read token (only happens once)
      const token = this.token || process.env.GRAPH_TOKEN;
      if (!token) {
        // Token will be set by index.ts before any command runs
        IPC.error("GraphService.getClient() called before token initialization");
        process.exit(1);
      }
      this.instance = Client.init({
        authProvider: (done) => done(null, token),
      });
    }
    return this.instance;
  }

  // Initialize token before any commands run
  public static async initialize(): Promise<void> {
    await this.getToken();
  }
}
