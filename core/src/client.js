import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";
export class GraphService {
    static instance;
    static getInstance() {
        if (!this.instance) {
            const token = process.env.GRAPH_TOKEN;
            if (!token) {
                throw new Error("GRAPH_TOKEN environment variable is not set.");
            }
            this.instance = Client.init({
                authProvider: (done) => {
                    done(null, token);
                },
            });
        }
        return this.instance;
    }
}
