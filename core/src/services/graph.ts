import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
import { IPC } from "../utils/ipc";

export class GraphService {
  private static instance: Client;

  public static getClient(): Client {
    if (!this.instance) {
      const token = process.env.GRAPH_TOKEN;
      if (!token) {
        IPC.error("GRAPH_TOKEN env var missing. Did Rust inject it?");
        process.exit(1);
      }
      this.instance = Client.init({
        authProvider: (done) => done(null, token),
      });
    }
    return this.instance;
  }
}
