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
        // The Microsoft Graph JS SDK includes retry middleware by default.
        // It handles 429 (Too Many Requests) and 503 (Service Unavailable).
      });
    }
    return this.instance;
  }

  /**
   * Fetch a single resource
   */
  public static async get<T = any>(endpoint: string, version: 'v1.0' | 'beta' = 'v1.0'): Promise<T> {
    const client = this.getClient();
    return await client.api(endpoint).version(version).get();
  }

  /**
   * Generically fetch all items from a collection, following @odata.nextLink automatically.
   * Supports both string (select fields) and options object syntax.
   */
  public static async fetchAll<T = any>(
    endpoint: string,
    selectOrOptions?: string | { select?: string, filter?: string, expand?: string, top?: number },
    version: 'v1.0' | 'beta' = 'v1.0'
  ): Promise<T[]> {
    const client = this.getClient();
    let results: T[] = [];

    let request = client.api(endpoint).version(version);

    // Handle both string and object syntax
    if (typeof selectOrOptions === 'string') {
      request = request.select(selectOrOptions);
    } else if (selectOrOptions && typeof selectOrOptions === 'object') {
      if (selectOrOptions.select) request = request.select(selectOrOptions.select);
      if (selectOrOptions.filter) request = request.filter(selectOrOptions.filter);
      if (selectOrOptions.expand) request = request.expand(selectOrOptions.expand);
      if (selectOrOptions.top) request = request.top(selectOrOptions.top);
    }

    let response = await request.get();
    results = results.concat(response.value || []);

    // Follow pagination
    while (response["@odata.nextLink"]) {
      response = await client.api(response["@odata.nextLink"]).get();
      results = results.concat(response.value || []);
    }

    return results;
  }

  // Initialize token before any commands run
  public static async initialize(): Promise<void> {
    await this.getToken();
  }
}