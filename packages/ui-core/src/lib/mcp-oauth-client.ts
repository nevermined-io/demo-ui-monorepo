/**
 * MCP OAuth Client - OAuth 2.1 implementation for MCP agents
 * @module mcp-oauth-client
 */

/**
 * Discovery metadata types
 */
interface ResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
}

interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
}

/**
 * MCP OAuth 2.1 Client with PKCE support
 * Only for MCP agent communication, HTTP agent uses Nevermined flow
 */
export class McpOAuthClient {
  private mcpServerUrl: string;
  private baseUrl: string;
  private redirectUri: string;
  private clientId?: string;
  private accessToken?: string;

  // Metadata descubierta
  private authorizationServer?: string;
  private authorizationEndpoint?: string;
  private tokenEndpoint?: string;
  private scopes?: string[];

  /**
   * Creates a new MCP OAuth client
   * @param mcpServerUrl - URL of the MCP server (e.g., http://localhost:4002/mcp)
   * @param redirectUri - OAuth redirect URI for this application
   */
  constructor(mcpServerUrl: string, redirectUri: string) {
    this.mcpServerUrl = mcpServerUrl;
    this.redirectUri = redirectUri;

    // Extract base URL (without path) for .well-known endpoints
    // e.g., http://localhost:4002/mcp -> http://localhost:4002
    try {
      const url = new URL(mcpServerUrl);
      this.baseUrl = `${url.protocol}//${url.host}`;
    } catch (error) {
      // Fallback: use as-is if URL parsing fails
      this.baseUrl = mcpServerUrl;
    }
  }

  /**
   * Discovers OAuth endpoints from MCP server
   * Step 1 of OAuth flow
   */
  async discover(): Promise<void> {
    try {
      // Paso 1: Obtener metadata del recurso protegido
      // IMPORTANT: .well-known must be at the server root, not in the MCP path
      const resourceMetadataUrl = `${this.baseUrl}/.well-known/oauth-protected-resource`;
      const resourceResponse = await fetch(resourceMetadataUrl);

      if (!resourceResponse.ok) {
        throw new Error(
          `Failed to discover resource metadata: ${resourceResponse.statusText}`
        );
      }

      const resourceMetadata: ResourceMetadata = await resourceResponse.json();
      this.authorizationServer = resourceMetadata.authorization_servers[0];

      if (!this.authorizationServer) {
        throw new Error("No authorization server found in resource metadata");
      }

      // Step 2: Get authorization server metadata
      const authServerMetadataUrl = `${this.authorizationServer}/.well-known/oauth-authorization-server`;
      const authServerResponse = await fetch(authServerMetadataUrl);

      if (!authServerResponse.ok) {
        // Try OpenID Connect discovery as fallback
        const oidcUrl = `${this.authorizationServer}/.well-known/openid-configuration`;
        const oidcResponse = await fetch(oidcUrl);

        if (!oidcResponse.ok) {
          throw new Error("Failed to discover authorization server metadata");
        }

        const authServerMetadata: AuthServerMetadata =
          await oidcResponse.json();
        this.authorizationEndpoint = authServerMetadata.authorization_endpoint;
        this.tokenEndpoint = authServerMetadata.token_endpoint;
        this.scopes =
          resourceMetadata.scopes_supported ||
          authServerMetadata.scopes_supported ||
          [];
        return;
      }

      const authServerMetadata: AuthServerMetadata =
        await authServerResponse.json();
      this.authorizationEndpoint = authServerMetadata.authorization_endpoint;
      this.tokenEndpoint = authServerMetadata.token_endpoint;
      this.scopes =
        resourceMetadata.scopes_supported ||
        authServerMetadata.scopes_supported ||
        [];

      console.log("[McpOAuthClient] Discovery completed", {
        mcpServerUrl: this.mcpServerUrl,
        baseUrl: this.baseUrl,
        authorizationServer: this.authorizationServer,
        authorizationEndpoint: this.authorizationEndpoint,
        tokenEndpoint: this.tokenEndpoint,
        scopes: this.scopes,
      });
    } catch (error) {
      console.error("[McpOAuthClient] Discovery failed:", error);
      throw error;
    }
  }

  /**
   * Registers client with authorization server (if dynamic registration is supported)
   * Step 2 of OAuth flow (optional)
   */
  async registerClient(): Promise<void> {
    if (!this.authorizationServer) {
      await this.discover();
    }

    try {
      // Try to get registration endpoint
      const authServerMetadataUrl = `${this.authorizationServer}/.well-known/oauth-authorization-server`;
      const response = await fetch(authServerMetadataUrl);
      const metadata: AuthServerMetadata = await response.json();

      if (metadata.registration_endpoint) {
        // Dynamic registration
        const registrationRequest = {
          client_name: "MCP Weather Client",
          redirect_uris: [this.redirectUri],
          grant_types: ["authorization_code"],
          response_types: ["code"],
          token_endpoint_auth_method: "none", // PKCE no requiere client_secret
          code_challenge_method: "S256",
        };

        const regResponse = await fetch(metadata.registration_endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(registrationRequest),
        });

        if (!regResponse.ok) {
          throw new Error(
            `Client registration failed: ${regResponse.statusText}`
          );
        }

        const clientInfo = await regResponse.json();
        this.clientId = clientInfo.client_id;

        if (!this.clientId) {
          throw new Error("Client registration did not return client_id");
        }

        // Store clientId in localStorage
        localStorage.setItem("mcp_client_id", this.clientId);

        console.log("[McpOAuthClient] Client registered:", this.clientId);
      } else {
        // Use pre-configured client_id from environment variables
        // Try to get pre-configured client ID from environment
        const env = (import.meta as any).env;
        this.clientId = (env.VITE_MCP_CLIENT_ID as string) || "";

        if (!this.clientId) {
          throw new Error(
            "Client ID required but not found in registration or config"
          );
        }

        console.log("[McpOAuthClient] Using pre-configured client ID");
      }
    } catch (error) {
      console.error("[McpOAuthClient] Client registration failed:", error);
      throw error;
    }
  }

  /**
   * Generates PKCE code verifier and challenge using Web Crypto API
   */
  private async generatePKCE(): Promise<{
    codeVerifier: string;
    codeChallenge: string;
  }> {
    // Generate code_verifier (43-128 characters, URL-safe)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const codeVerifier = this.base64URLEncode(array);

    // Generate code_challenge = SHA256(code_verifier) in base64url
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const codeChallenge = this.base64URLEncode(new Uint8Array(hash));

    return { codeVerifier, codeChallenge };
  }

  /**
   * Base64 URL-safe encoding for browser
   */
  private base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  /**
   * Prepares OAuth authorization URL without redirecting
   * Returns the URL that should be used for the "Connect" button
   */
  async prepareAuthorizationUrl(): Promise<string> {
    console.log("[McpOAuthClient] prepareAuthorizationUrl() called");

    if (!this.clientId) {
      await this.registerClient();
    }

    if (!this.authorizationEndpoint || !this.scopes) {
      await this.discover();
    }

    // Check if state and code_verifier already exist in sessionStorage
    // If they do, reuse them to avoid regenerating on each render
    let state = sessionStorage.getItem("oauth_state");
    let codeVerifier = sessionStorage.getItem("oauth_code_verifier");
    let codeChallenge: string;

    if (state && codeVerifier) {
      // Reuse existing values
      console.log(
        "[McpOAuthClient] Reusing existing state and verifier:",
        state
      );

      // Regenerate code_challenge from existing verifier
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hash = await crypto.subtle.digest("SHA-256", data);
      codeChallenge = this.base64URLEncode(new Uint8Array(hash));
    } else {
      // Generate new PKCE and state values
      const pkce = await this.generatePKCE();
      codeVerifier = pkce.codeVerifier;
      codeChallenge = pkce.codeChallenge;

      // Generate state for CSRF protection
      const stateArray = new Uint8Array(16);
      crypto.getRandomValues(stateArray);
      state = this.base64URLEncode(stateArray);

      // Store temporarily
      sessionStorage.setItem("oauth_code_verifier", codeVerifier);
      sessionStorage.setItem("oauth_state", state);

      console.log("[McpOAuthClient] Generated and stored NEW state:", state);
    }

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      scope: this.scopes!.join(" "),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authorizationUrl = `${this.authorizationEndpoint}?${params.toString()}`;

    console.log(
      "[McpOAuthClient] Authorization URL prepared:",
      authorizationUrl
    );

    return authorizationUrl;
  }

  /**
   * Initiates OAuth authorization flow (redirects immediately)
   * Step 3 of OAuth flow
   */
  async startAuthorizationFlow(): Promise<void> {
    const authorizationUrl = await this.prepareAuthorizationUrl();

    console.log("[McpOAuthClient] Redirecting to authorization endpoint");

    // Redirigir usuario al navegador
    window.location.href = authorizationUrl;
  }

  /**
   * Completes authorization flow after callback
   * Step 4 of OAuth flow
   */
  async completeAuthorizationFlow(): Promise<boolean> {
    try {
      // Extract code from URL
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        throw new Error(`Authorization error: ${error}`);
      }

      if (!code || !state) {
        return false; // No hay callback en esta URL
      }

      // Validar state
      const storedState = sessionStorage.getItem("oauth_state");
      console.log("[McpOAuthClient] State validation:");
      console.log("  - State from URL:", state);
      console.log("  - State from storage:", storedState);
      console.log("  - Match:", state === storedState);

      if (state !== storedState) {
        throw new Error("Invalid state parameter - possible CSRF attack");
      }

      // Obtener code_verifier
      const codeVerifier = sessionStorage.getItem("oauth_code_verifier");
      if (!codeVerifier) {
        throw new Error("Code verifier not found in session");
      }

      // Clean URL
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, document.title, url.toString());

      if (!this.tokenEndpoint) {
        await this.discover();
      }

      if (!this.clientId) {
        this.clientId = localStorage.getItem("mcp_client_id") || "";
      }

      // Intercambiar code por token
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId!,
        code_verifier: codeVerifier,
      });

      const response = await fetch(this.tokenEndpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Token exchange failed: ${errorData.error_description || errorData.error}`
        );
      }

      const tokenData: TokenResponse = await response.json();

      // Store access token
      this.accessToken = tokenData.access_token;

      // Clear temporary data
      sessionStorage.removeItem("oauth_code_verifier");
      sessionStorage.removeItem("oauth_state");

      // Persistir access token
      localStorage.setItem("mcp_access_token", this.accessToken);

      console.log("[McpOAuthClient] Authorization completed successfully");

      return true;
    } catch (error) {
      console.error(
        "[McpOAuthClient] Authorization flow completion failed:",
        error
      );
      throw error;
    }
  }

  /**
   * Ensures a valid access token is available
   * Returns the access token or throws if not available
   */
  async ensureValidToken(): Promise<string> {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem("mcp_access_token") || undefined;
    }

    if (!this.accessToken) {
      throw new Error("No access token available - authorization required");
    }

    return this.accessToken;
  }

  /**
   * Gets the current access token
   * Throws if not authenticated
   */
  async getAccessToken(): Promise<string> {
    return await this.ensureValidToken();
  }

  /**
   * Checks if user is authenticated
   */
  isAuthenticated(): boolean {
    if (this.accessToken) {
      return true;
    }

    const storedToken = localStorage.getItem("mcp_access_token");
    if (storedToken) {
      this.accessToken = storedToken;
      return true;
    }

    return false;
  }

  /**
   * Clears all stored tokens and client data
   */
  clearTokens(): void {
    this.accessToken = undefined;
    localStorage.removeItem("mcp_access_token");
    localStorage.removeItem("mcp_client_id");

    const env = (import.meta as any).env;
    const transport = env?.VITE_TRANSPORT as string | undefined;
    if (transport === "mcp") {
      localStorage.removeItem("nvmPlanId_mcp");
    }

    console.log("[McpOAuthClient] Tokens cleared");
  }

  /**
   * Logs out the user
   */
  async logout(): Promise<void> {
    this.clearTokens();

    // Redirect to home page
    window.location.href = "/";
  }
}
