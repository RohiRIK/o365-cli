use anyhow::{Context, Result};
use oauth2::basic::BasicClient;
use oauth2::{
    AuthUrl, ClientId, CsrfToken, PkceCodeChallenge, RedirectUrl, RefreshToken, Scope, TokenResponse,
    TokenUrl, AuthorizationCode, HttpRequest, HttpResponse,
};
use std::env;
use std::fmt;
use std::fs;
use std::path::PathBuf;
use std::net::TcpListener;
use std::io::{BufRead, BufReader, Write};
use url::Url;
use reqwest::Client as ReqwestClient;
use keyring::Entry;

// Official "Microsoft Graph PowerShell" Client ID
const DEFAULT_CLIENT_ID: &str = "14d82eec-204b-4c2f-b7e8-296a70dab67e";
const KEYRING_SERVICE: &str = "o365-cli";
const KEYRING_USER: &str = "refresh_token";

pub struct AuthManager {
    client_id: ClientId,
    auth_url: AuthUrl,
    token_url: TokenUrl,
}

#[derive(Debug)]
pub enum HttpClientError {
    Reqwest(reqwest::Error),
    Http(oauth2::http::Error),
}

impl fmt::Display for HttpClientError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            HttpClientError::Reqwest(e) => write!(f, "Reqwest error: {}", e),
            HttpClientError::Http(e) => write!(f, "HTTP error: {}", e),
        }
    }
}

impl std::error::Error for HttpClientError {}

impl From<reqwest::Error> for HttpClientError {
    fn from(e: reqwest::Error) -> Self {
        HttpClientError::Reqwest(e)
    }
}

impl From<oauth2::http::Error> for HttpClientError {
    fn from(e: oauth2::http::Error) -> Self {
        HttpClientError::Http(e)
    }
}

fn get_keyring_entry() -> Result<Entry> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .context("Failed to access system keyring")
}

fn get_legacy_cache_path() -> Result<PathBuf> {
    let current_dir = std::env::current_dir()?;
    let root_dir = if current_dir.ends_with("cli") {
        current_dir
    } else {
        current_dir.join("cli")
    };
    Ok(root_dir.join(".o365_cli_token"))
}

// Migrate old file-based token to keyring
fn migrate_legacy_token() -> Result<()> {
    let legacy_path = get_legacy_cache_path()?;
    
    if !legacy_path.exists() {
        return Ok(()); // Nothing to migrate
    }
    
    // Read old token
    let token = fs::read_to_string(&legacy_path)
        .context("Failed to read legacy token file")?;
    
    if token.trim().is_empty() {
        fs::remove_file(&legacy_path)?;
        return Ok(());
    }
    
    // Store in keyring
    let entry = get_keyring_entry()?;
    entry.set_password(token.trim())
        .context("Failed to migrate token to keyring")?;
    
    // Remove old file
    fs::remove_file(&legacy_path)?;
    
    log::info!("Successfully migrated token from file to keyring");
    Ok(())
}

pub fn clear_keychain_entry() -> Result<()> {
    log::debug!("[AUTH] Clearing keychain entry...");
    // Clear keyring
    let entry = get_keyring_entry()?;
    match entry.delete_credential() {
        Ok(_) => {
            log::info!("[AUTH] Keyring credential deleted successfully");
        },
        Err(keyring::Error::NoEntry) => {
            log::debug!("[AUTH] No existing keyring entry to delete");
        },
        Err(e) => return Err(anyhow::anyhow!("Failed to clear keyring: {}", e)),
    }
    
    // Also clear legacy file if it exists
    if let Ok(legacy_path) = get_legacy_cache_path() {
        if legacy_path.exists() {
            let _ = fs::remove_file(legacy_path);
            log::info!("[AUTH] Removed legacy token file");
        }
    }
    
    Ok(())
}

impl AuthManager {
    pub fn new(tenant_id: &str) -> Result<Self> {
        let client_id_str = env::var("AZURE_CLIENT_ID").unwrap_or_else(|_| DEFAULT_CLIENT_ID.to_string());
        
        Ok(Self {
            client_id: ClientId::new(client_id_str),
            auth_url: AuthUrl::new(format!(
                "https://login.microsoftonline.com/{}/oauth2/v2.0/authorize",
                tenant_id
            ))?,
            token_url: TokenUrl::new(format!(
                "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
                tenant_id
            ))?,
        })
    }

    async fn http_client(request: HttpRequest) -> Result<HttpResponse, HttpClientError> {
        let client = ReqwestClient::new();
        let mut builder = client
            .request(request.method().clone(), request.uri().to_string())
            .body(request.body().clone());

        for (name, value) in request.headers() {
            builder = builder.header(name, value);
        }

        let response = builder.send().await?;
        
        let mut resp_builder = oauth2::http::Response::builder()
            .status(response.status());
            
        for (name, value) in response.headers() {
            resp_builder = resp_builder.header(name, value);
        }

        let body = response.bytes().await?.to_vec();
        
        Ok(resp_builder.body(body)?)
    }

    pub async fn login(&self) -> Result<String> {
        log::info!("[AUTH] Starting login flow...");
        clear_keychain_entry()?;
        log::info!("[AUTH] Cleared existing keychain entries");

        // 1. Setup Local Listener
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();
        let redirect_uri = format!("http://localhost:{}", port);
        
        // println!("🌐 Listening on {}", redirect_uri);

        // 2. Setup Client
        let client = BasicClient::new(self.client_id.clone())
            .set_auth_uri(self.auth_url.clone())
            .set_token_uri(self.token_url.clone())
            .set_redirect_uri(RedirectUrl::new(redirect_uri.clone())?);

        // 3. Generate PKCE Challenge
        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        // 4. Generate Auth URL with CSRF protection
        let (auth_url, csrf_token) = client
            .authorize_url(CsrfToken::new_random)
            .add_scope(Scope::new("User.Read".to_string()))
            .add_scope(Scope::new("Directory.ReadWrite.All".to_string()))
            .add_scope(Scope::new("offline_access".to_string()))
            .set_pkce_challenge(pkce_challenge)
            .url();
        
        let csrf_state = csrf_token.secret().clone();
        log::info!("[AUTH] Generated auth URL with scopes: User.Read, Directory.ReadWrite.All, offline_access");
        log::debug!("[AUTH] Auth URL: {}", auth_url);

        // 5. Open Browser
        log::info!("[AUTH] Opening browser for authentication...");
        if webbrowser::open(auth_url.as_str()).is_err() {
             log::warn!("[AUTH] Failed to open browser automatically. URL: {}", auth_url);
        } else {
             log::info!("[AUTH] Browser opened successfully");
        }

        // 6. Wait for Callback
        log::info!("[AUTH] Waiting for OAuth callback...");
        let (mut stream, _) = listener.accept()?;
        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        reader.read_line(&mut request_line)?;
        log::debug!("[AUTH] Received HTTP request: {}", request_line.trim());

        // Extract code from "GET /?code=... HTTP/1.1"
        let redirect_path = request_line.split_whitespace().nth(1).unwrap_or("/");
        
        // Ignore favicon.ico requests which might steal the connection
        if redirect_path.contains("favicon.ico") {
             return Err(anyhow::anyhow!("Browser requested favicon.ico, confusing the listener. Please try again."));
        }

        let url = Url::parse(&format!("http://localhost:{}", port))
             .unwrap()
             .join(redirect_path)?;
        
        // Validate CSRF state parameter
        let state_param = url.query_pairs()
            .find(|(key, _)| key == "state")
            .ok_or_else(|| anyhow::anyhow!("Missing state parameter in OAuth callback"))?;
        
        if state_param.1 != csrf_state {
            log::error!("[AUTH] CSRF validation failed - state mismatch");
            return Err(anyhow::anyhow!("CSRF validation failed: state mismatch"));
        }
        log::info!("[AUTH] CSRF validation passed");
        
        let code_pair = url.query_pairs()
            .find(|(key, _)| key == "code")
            .ok_or_else(|| anyhow::anyhow!("Failed to retrieve authorization code from callback. Received: {}", redirect_path))?;
            
        let code = AuthorizationCode::new(code_pair.1.to_string());
        log::info!("[AUTH] Authorization code received (length: {})", code.secret().len());

        // Send Response to Browser
        let message = "Login Successful! You can close this window and return to the terminal.";
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n{}",
            message.len(),
            message
        );
        stream.write_all(response.as_bytes())?;
        log::info!("[AUTH] Sent success response to browser");

        // 7. Exchange Code for Token
        log::info!("[AUTH] Exchanging authorization code for tokens...");
        let token_result = client
            .exchange_code(code)
            .set_pkce_verifier(pkce_verifier)
            .request_async(&Self::http_client)
            .await?;
        log::info!("[AUTH] Token exchange successful");

        let access_token = token_result.access_token().secret().clone();
        log::debug!("[AUTH] Access token received (length: {})", access_token.len());

        // Store refresh token securely in system keyring
        if let Some(new_refresh_token) = token_result.refresh_token() {
            log::info!("[AUTH] Refresh token received from OAuth response");
            let entry = get_keyring_entry()?;
            log::debug!("[AUTH] Keyring entry created for service: o365-cli, account: refresh_token");
            entry.set_password(new_refresh_token.secret())
                .context("Failed to store refresh token in keyring")?;
            log::info!("[AUTH] ✅ Refresh token stored in keyring successfully");
        } else {
            log::error!("[AUTH] ❌ OAuth token response did NOT include refresh token");
            log::error!("[AUTH] This indicates offline_access scope was not consented or the app lacks permission");
            return Err(anyhow::anyhow!("Microsoft did not return a refresh token. This usually means the 'offline_access' scope was not consented. Please retry login and ensure you consent to all permissions."));
        }

        log::info!("[AUTH] Login flow completed successfully");
        Ok(access_token)
    }

    pub async fn get_access_token(&self) -> Result<String> {
        log::info!("[AUTH] Attempting to retrieve access token...");
        // Try to migrate legacy token first
        let _ = migrate_legacy_token();
        
        // Retrieve refresh token from secure keyring
        log::debug!("[AUTH] Retrieving refresh token from keyring...");
        let entry = get_keyring_entry()?;
        let refresh_token_secret = entry.get_password()
            .context("No credentials found. Please run `o365-cli login`.")?;
        log::info!("[AUTH] Refresh token retrieved from keyring");

        let refresh_token = RefreshToken::new(refresh_token_secret.trim().to_string());

        let client = BasicClient::new(self.client_id.clone())
            .set_auth_uri(self.auth_url.clone())
            .set_token_uri(self.token_url.clone());
        
        log::info!("[AUTH] Exchanging refresh token for new access token...");
        let token_result = client
            .exchange_refresh_token(&refresh_token)
            .request_async(&Self::http_client)
            .await
            .context("Failed to refresh token. Please login again.")?;
        log::info!("[AUTH] Access token refreshed successfully");

        // Update refresh token in keyring if rotated
        if let Some(new_refresh_token) = token_result.refresh_token() {
            log::info!("[AUTH] New refresh token received, updating keyring...");
            entry.set_password(new_refresh_token.secret())
                .context("Failed to update refresh token in keyring")?;
            log::info!("[AUTH] Refresh token updated in keyring");
        }

        Ok(token_result.access_token().secret().clone())
    }
}