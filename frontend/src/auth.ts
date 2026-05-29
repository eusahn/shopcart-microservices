import Keycloak from "keycloak-js";
import { useEffect, useState, useCallback } from "react";

// Wiring matches the realm seeded by platform/keycloak/shopcart-realm.json:
//   realm:    shopcart
//   clientId: shopcart-web (public, PKCE)
// Local dev:  docker-compose runs Keycloak on http://localhost:8181
// Cluster:    the browser hits http://keycloak.local through the Ingress

const url    = import.meta.env.VITE_KEYCLOAK_URL    ?? "http://localhost:8181";
const realm  = import.meta.env.VITE_KEYCLOAK_REALM  ?? "shopcart";
const client = import.meta.env.VITE_KEYCLOAK_CLIENT ?? "shopcart-web";

// Escape hatch — set VITE_AUTH_DISABLED=true to bypass Keycloak entirely.
// The gateway must be started with AUTH_DISABLED=true too; in that mode it
// reads the x-dev-user header and treats the user as "dev-user".
const AUTH_DISABLED = import.meta.env.VITE_AUTH_DISABLED === "true";

export const keycloak = AUTH_DISABLED ? (null as unknown as Keycloak) : new Keycloak({ url, realm, clientId: client });

let initPromise: Promise<boolean> | null = null;
const initOnce = (): Promise<boolean> => {
  if (AUTH_DISABLED) return Promise.resolve(true);
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      checkLoginIframe: false,
      // Silent redirect HTML keeps the SSO check from full-page-navigating
      // when there's no session yet.
      silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
    });
  }
  return initPromise;
};

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  username?: string;
  login(): void;
  logout(): void;
  token(): Promise<string | undefined>;
}

export function useAuth(): AuthState {
  const [ready, setReady] = useState(AUTH_DISABLED);
  const [authed, setAuthed] = useState(AUTH_DISABLED);

  useEffect(() => {
    if (AUTH_DISABLED) return;
    initOnce()
      .then((ok) => { setAuthed(ok); setReady(true); })
      .catch((err) => {
        console.warn("keycloak init failed — continuing without auth:", err);
        setReady(true);
      });

    keycloak.onAuthSuccess = () => setAuthed(true);
    keycloak.onAuthLogout  = () => setAuthed(false);
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.login());
    };
  }, []);

  const token = useCallback(async () => {
    if (AUTH_DISABLED) return undefined;
    if (!keycloak.authenticated) return undefined;
    try { await keycloak.updateToken(30); }
    catch { keycloak.login(); }
    return keycloak.token;
  }, []);

  if (AUTH_DISABLED) {
    return {
      ready: true,
      authenticated: true,
      username: "dev-user",
      login:  () => undefined,
      logout: () => undefined,
      token,
    };
  }

  return {
    ready,
    authenticated: authed,
    username:
      (keycloak.tokenParsed?.preferred_username as string | undefined) ??
      (keycloak.tokenParsed?.email as string | undefined),
    login:  () => keycloak.login(),
    logout: () => keycloak.logout({ redirectUri: window.location.origin }),
    token,
  };
}
