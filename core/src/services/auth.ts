import crypto from "crypto";
import http from "http";
import open from "open";

const CLIENT_ID = "14d82eec-204b-4c2f-b7e8-296a70dab67e"; // Microsoft Graph PowerShell
const SCOPES = [
  "User.Read", 
  "Directory.Read.All", 
  "Organization.Read.All", 
  "DeviceManagementConfiguration.Read.All",
  "DeviceManagementApps.Read.All",
  "DeviceManagementServiceConfig.Read.All",
  "DeviceManagementManagedDevices.Read.All",
  "DeviceManagementRBAC.Read.All",
  "Device.Read.All",
  "DeviceManagementScripts.Read.All",
  "offline_access"
];
const REDIRECT_URI = "http://localhost:8400";
const PORT = 8400;

export class AuthService {
  private tenantId: string;

  constructor(tenantId: string = "common") {
    this.tenantId = tenantId;
  }

  static generatePKCE() {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
  }

  getAuthorizationUrl(challenge: string, state: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(" "),
      response_mode: "query",
      prompt: "select_account",
      state: state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async login(): Promise<{ accessToken: string; refreshToken?: string }> {
    const { verifier, challenge } = AuthService.generatePKCE();
    const state = crypto.randomBytes(16).toString("hex");
    const authUrl = this.getAuthorizationUrl(challenge, state);

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`);
          
          if (url.pathname !== "/") {
            res.writeHead(404);
            res.end();
            return;
          }

          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`<h1>Login Failed</h1><p>${error}</p>`);
            reject(new Error(`Login failed: ${error}`));
            return;
          }

          if (returnedState !== state) {
             res.writeHead(400, { "Content-Type": "text/html" });
             res.end(`<h1>Invalid State</h1>`);
             reject(new Error("Invalid state parameter"));
             return;
          }

          if (code) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("<h1>Login Successful</h1><p>You can close this window.</p>");
            
            // Exchange code for token
            try {
              const tokens = await this.exchangeCodeForToken(code, verifier);
              resolve(tokens);
            } catch (e) {
              reject(e);
            }
          }
        } finally {
          server.close();
        }
      });

      server.listen(PORT, async () => {
        console.log(`Listening on ${PORT}...`);
        await open(authUrl);
      });
      
      server.on("error", (err) => {
          reject(err);
      });
    });
  }

  private async exchangeCodeForToken(code: string, verifier: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES.join(" "),
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: verifier,
    });

    const response = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const data = await response.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES.join(" "),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed: ${text}`);
    }

    const data = await response.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }
}
