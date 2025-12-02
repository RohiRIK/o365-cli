use anyhow::{Context, Result};
use oauth2::basic::BasicClient;
use oauth2::{
    AuthUrl, ClientId, CsrfToken, PkceCodeChallenge, RedirectUrl, RefreshToken, Scope, TokenResponse,
    TokenUrl, AuthorizationCode, HttpRequest, HttpResponse,
};
use std::env;
use std::fmt;
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

pub fn clear_keychain_entry() -> Result<()> {
    let entry = get_keyring_entry()?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already cleared
        Err(e) => Err(anyhow::anyhow!("Failed to clear keyring: {}", e)),
    }
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
        clear_keychain_entry()?;

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

        // 5. Open Browser
        // println!("🚀 Opening browser for authentication...");
        if webbrowser::open(auth_url.as_str()).is_err() {
             // println!("⚠️  Failed to open browser automatically.");
             // println!("🔗 Please open this URL manually: {}", auth_url);
        }

        // 6. Wait for Callback
        let (mut stream, _) = listener.accept()?;
        let mut reader = BufReader::new(&stream);
        let mut request_line = String::new();
        reader.read_line(&mut request_line)?;

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
            return Err(anyhow::anyhow!("CSRF validation failed: state mismatch"));
        }
        
        let code_pair = url.query_pairs()
            .find(|(key, _)| key == "code")
            .ok_or_else(|| anyhow::anyhow!("Failed to retrieve authorization code from callback. Received: {}", redirect_path))?;
            
        let code = AuthorizationCode::new(code_pair.1.to_string());

        // Send Response to Browser
        let message = "Login Successful! You can close this window and return to the terminal.";
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n{}",
            message.len(),
            message
        );
        stream.write_all(response.as_bytes())?;

        // 7. Exchange Code for Token
        // println!("🔄 Exchanging code for token...");
        let token_result = client
            .exchange_code(code)
            .set_pkce_verifier(pkce_verifier)
            .request_async(&Self::http_client)
            .await?;

        let access_token = token_result.access_token().secret().clone();

        // Store refresh token securely in system keyring
        if let Some(new_refresh_token) = token_result.refresh_token() {
            let entry = get_keyring_entry()?;
            entry.set_password(new_refresh_token.secret())
                .context("Failed to store refresh token in keyring")?;
        }

        Ok(access_token)
    }

    pub async fn get_access_token(&self) -> Result<String> {
        // Retrieve refresh token from secure keyring
        let entry = get_keyring_entry()?;
        let refresh_token_secret = entry.get_password()
            .context("No credentials found. Please run `o365-cli login`.")?;

        let refresh_token = RefreshToken::new(refresh_token_secret.trim().to_string());

        let client = BasicClient::new(self.client_id.clone())
            .set_auth_uri(self.auth_url.clone())
            .set_token_uri(self.token_url.clone());
        
        let token_result = client
            .exchange_refresh_token(&refresh_token)
            .request_async(&Self::http_client)
            .await
            .context("Failed to refresh token. Please login again.")?;

        // Update refresh token in keyring if rotated
        if let Some(new_refresh_token) = token_result.refresh_token() {
            entry.set_password(new_refresh_token.secret())
                .context("Failed to update refresh token in keyring")?;
        }

        Ok(token_result.access_token().secret().clone())
    }
}