import crypto from "crypto";
import type { Response } from "express";
import type { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

interface StoredToken {
  clientId: string;
  scopes: string[];
  expiresAt: number;
  refreshToken?: string;
}

interface PendingAuth {
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
}

export class SimpleOAuthProvider implements OAuthServerProvider {
  private clients = new Map<string, OAuthClientInformationFull>();
  private tokens = new Map<string, StoredToken>();
  private refreshTokens = new Map<string, string>();
  private pendingAuths = new Map<string, PendingAuth>();

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => this.clients.get(clientId),
      registerClient: (client) => {
        const full: OAuthClientInformationFull = {
          ...client,
          client_id: crypto.randomUUID(),
          client_id_issued_at: Math.floor(Date.now() / 1000),
          client_secret: crypto.randomBytes(32).toString("hex"),
          client_secret_expires_at: 0,
        };
        this.clients.set(full.client_id, full);
        return full;
      },
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: { state?: string; scopes?: string[]; codeChallenge: string; redirectUri: string },
    res: Response
  ): Promise<void> {
    const authCode = crypto.randomBytes(16).toString("hex");
    this.pendingAuths.set(authCode, {
      codeChallenge: params.codeChallenge,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? [],
      state: params.state,
    });

    const approveUrl = new URL(params.redirectUri);
    approveUrl.searchParams.set("code", authCode);
    if (params.state) approveUrl.searchParams.set("state", params.state);
    const approveHref = approveUrl.toString();

    const clientName = client.client_name ?? client.client_id;

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize — Local MCP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); padding: 40px; max-width: 380px; width: 100%; text-align: center; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #111; }
    p { color: #666; font-size: 14px; margin-bottom: 28px; line-height: 1.5; }
    strong { color: #111; }
    a { display: block; background: #0070f3; color: white; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 500; text-decoration: none; transition: background 0.15s; }
    a:hover { background: #0051cc; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔌</div>
    <h1>Local MCP Server</h1>
    <p><strong>${clientName}</strong> is requesting access to your local MCP server.</p>
    <a href="${approveHref}">Approve</a>
  </div>
</body>
</html>`);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const pending = this.pendingAuths.get(authorizationCode);
    if (!pending) throw new Error("Unknown authorization code");
    return pending.codeChallenge;
  }

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    const pending = this.pendingAuths.get(authorizationCode);
    if (!pending) throw new Error("Unknown or expired authorization code");
    this.pendingAuths.delete(authorizationCode);

    const accessToken = crypto.randomBytes(32).toString("hex");
    const refreshToken = crypto.randomBytes(32).toString("hex");
    const expiresIn = 3600;

    this.tokens.set(accessToken, {
      clientId: pending.clientId,
      scopes: pending.scopes,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      refreshToken,
    });
    this.refreshTokens.set(refreshToken, accessToken);

    return { access_token: accessToken, token_type: "bearer", expires_in: expiresIn, refresh_token: refreshToken };
  }

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    const oldAccess = this.refreshTokens.get(refreshToken);
    if (!oldAccess) throw new Error("Invalid refresh token");

    const stored = this.tokens.get(oldAccess);
    if (!stored) throw new Error("Invalid refresh token");

    this.tokens.delete(oldAccess);
    this.refreshTokens.delete(refreshToken);

    const newAccess = crypto.randomBytes(32).toString("hex");
    const newRefresh = crypto.randomBytes(32).toString("hex");
    const expiresIn = 3600;

    this.tokens.set(newAccess, {
      clientId: stored.clientId,
      scopes: scopes ?? stored.scopes,
      expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
      refreshToken: newRefresh,
    });
    this.refreshTokens.set(newRefresh, newAccess);

    return { access_token: newAccess, token_type: "bearer", expires_in: expiresIn, refresh_token: newRefresh };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const stored = this.tokens.get(token);
    if (!stored) throw new Error("Invalid access token");
    if (stored.expiresAt < Math.floor(Date.now() / 1000)) {
      this.tokens.delete(token);
      throw new Error("Access token expired");
    }
    return { token, clientId: stored.clientId, scopes: stored.scopes, expiresAt: stored.expiresAt };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    const t = request.token;
    const stored = this.tokens.get(t);
    if (stored) {
      if (stored.refreshToken) this.refreshTokens.delete(stored.refreshToken);
      this.tokens.delete(t);
    } else {
      const access = this.refreshTokens.get(t);
      if (access) {
        this.tokens.delete(access);
        this.refreshTokens.delete(t);
      }
    }
  }
}
