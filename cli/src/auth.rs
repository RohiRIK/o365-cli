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
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};

// Official "Microsoft Graph PowerShell" Client ID
const DEFAULT_CLIENT_ID: &str = "14d82eec-204b-4c2f-b7e8-296a70dab67e";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TokenStorage {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
}

impl TokenStorage {
    pub fn load(path: &PathBuf) -> Result<Self> {
        let content = fs::read_to_string(path).context("Failed to read token storage file")?;
        let storage: TokenStorage = serde_json::from_str(&content).context("Failed to parse token storage JSON")?;
        Ok(storage)
    }

    pub fn save(&self, path: &PathBuf) -> Result<()> {
        let content = serde_json::to_string_pretty(self).context("Failed to serialize token storage")?;
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).context("Failed to create token storage directory")?;
            }
        }

        fs::write(path, content).context("Failed to write token storage file")?;

        // Set permissions to 600 on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(path)?.permissions();
            perms.set_mode(0o600);
            fs::set_permissions(path, perms).context("Failed to set file permissions to 600")?;
        }

        Ok(())
    }
}

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

fn get_token_storage_path() -> Result<PathBuf> {
    let home = env::var("HOME").or_else(|_| env::var("USERPROFILE")).context("Failed to get HOME directory")?;
    Ok(PathBuf::from(home).join(".o365-cli").join("tokens.json"))
}

pub fn clear_token_storage() -> Result<()> {
    let path = get_token_storage_path()?;
    if path.exists() {
        fs::remove_file(path).context("Failed to remove token storage file")?;
        log::info!("[AUTH] Token storage cleared successfully");
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
        let _ = clear_token_storage();

        // 1. Setup Local Listener
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();
        let redirect_uri = format!("http://localhost:{}", port);

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

        // 5. Open Browser
        log::info!("[AUTH] Opening browser for authentication...");
        if webbrowser::open(auth_url.as_str()).is_err() {
             log::warn!("[AUTH] Failed to open browser automatically. URL: {}", auth_url);
        }

        // 6. Wait for Callback
        log::info!("[AUTH] Waiting for OAuth callback...");
        let (mut stream, _) = listener.accept()?;
        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        reader.read_line(&mut request_line)?;

        let redirect_path = request_line.split_whitespace().nth(1).unwrap_or("/");
        if redirect_path.contains("favicon.ico") {
             return Err(anyhow::anyhow!("Browser requested favicon.ico, confusing the listener. Please try again."));
        }

        let url = Url::parse(&format!("http://localhost:{}", port)).unwrap().join(redirect_path)?;
        let state_param = url.query_pairs().find(|(key, _)| key == "state").ok_or_else(|| anyhow::anyhow!("Missing state parameter"))?;
        
        if state_param.1 != csrf_state {
            return Err(anyhow::anyhow!("CSRF validation failed"));
        }
        
        let code_pair = url.query_pairs().find(|(key, _)| key == "code").ok_or_else(|| anyhow::anyhow!("Failed to retrieve code"))?;
        let code = AuthorizationCode::new(code_pair.1.to_string());

        let message = "Login Successful! You can close this window and return to the terminal.";
        let response = format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n{}", message.len(), message);
        stream.write_all(response.as_bytes())?;

        // 7. Exchange Code for Token
        log::info!("[AUTH] Exchanging authorization code for tokens...");
        let token_result = client
            .exchange_code(code)
            .set_pkce_verifier(pkce_verifier)
            .request_async(&Self::http_client)
            .await?;

        let access_token = token_result.access_token().secret().clone();
        let refresh_token = token_result.refresh_token()
            .ok_or_else(|| anyhow::anyhow!("Microsoft did not return a refresh token. Ensure 'offline_access' scope was consented."))?
            .secret().clone();

        let expires_in = token_result.expires_in().unwrap_or(std::time::Duration::from_secs(3600));
        let expires_at = Utc::now() + Duration::from_std(expires_in).unwrap_or(Duration::hours(1));

        let storage = TokenStorage {
            access_token: access_token.clone(),
            refresh_token,
            expires_at,
        };

        storage.save(&get_token_storage_path()?)?;
        log::info!("[AUTH] ✅ Tokens stored in JSON file successfully");

        Ok(access_token)
    }

    pub async fn get_access_token(&self) -> Result<String> {
        let path = get_token_storage_path()?;
        let mut storage = TokenStorage::load(&path).context("No credentials found. Please run `o365-cli login`.")?;

        // Check if token is expired or expiring soon (5 minute buffer)
        if Utc::now() + Duration::minutes(5) >= storage.expires_at {
            log::info!("[AUTH] Token expired or expiring soon. Attempting refresh...");
            self.refresh_tokens(&mut storage).await?;
            storage.save(&path)?;
        }

        Ok(storage.access_token)
    }

    pub async fn refresh_tokens(&self, storage: &mut TokenStorage) -> Result<()> {
        let client = BasicClient::new(self.client_id.clone())
            .set_auth_uri(self.auth_url.clone())
            .set_token_uri(self.token_url.clone());

        let refresh_token = RefreshToken::new(storage.refresh_token.clone());
        
        log::info!("[AUTH] Exchanging refresh token for new access token...");
        let token_result = client
            .exchange_refresh_token(&refresh_token)
            .request_async(&Self::http_client)
            .await
            .context("Failed to refresh token. Please login again.")?;

        storage.access_token = token_result.access_token().secret().clone();
        if let Some(new_refresh_token) = token_result.refresh_token() {
            storage.refresh_token = new_refresh_token.secret().clone();
        }

        let expires_in = token_result.expires_in().unwrap_or(std::time::Duration::from_secs(3600));
        storage.expires_at = Utc::now() + Duration::from_std(expires_in).unwrap_or(Duration::hours(1));

        log::info!("[AUTH] Tokens refreshed successfully");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

    #[test]
    fn test_token_storage_lifecycle() {
        let storage_path = PathBuf::from("test_tokens.json");
        if storage_path.exists() {
            fs::remove_file(&storage_path).unwrap();
        }

        let expires_at = Utc::now() + Duration::hours(1);
        let storage = TokenStorage {
            access_token: "test_access".to_string(),
            refresh_token: "test_refresh".to_string(),
            expires_at,
        };

        // Save
        storage.save(&storage_path).expect("Failed to save tokens");

        // Load
        let loaded = TokenStorage::load(&storage_path).expect("Failed to load tokens");
        assert_eq!(loaded.access_token, "test_access");
        assert_eq!(loaded.refresh_token, "test_refresh");
        // Compare timestamps with some tolerance for serialization
        assert_eq!(loaded.expires_at.timestamp(), expires_at.timestamp());

        // Cleanup
        fs::remove_file(&storage_path).unwrap();
    }
}
