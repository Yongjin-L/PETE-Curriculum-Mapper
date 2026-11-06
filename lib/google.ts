/* Google Identity Services (sign-in / access token) and Google Picker helpers.
 * Configuration comes from public environment variables set in Vercel:
 *   NEXT_PUBLIC_GOOGLE_CLIENT_ID  OAuth 2.0 Web client ID
 *   NEXT_PUBLIC_GOOGLE_API_KEY    API key restricted to the Google Picker API
 *   NEXT_PUBLIC_GOOGLE_APP_ID     Google Cloud project number (needed by the Picker)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export const GOOGLE_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "",
  appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "",
};

export const googleConfigured = () => !!GOOGLE_CONFIG.clientId;
export const pickerConfigured = () => !!(GOOGLE_CONFIG.clientId && GOOGLE_CONFIG.apiKey && GOOGLE_CONFIG.appId);

export const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
          scripts.delete(src);
          reject(new Error(`Could not load ${src}. Check your internet connection or ad blocker.`));
        };
        document.head.appendChild(s);
      })
    );
  }
  return scripts.get(src)!;
}

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export interface Token {
  accessToken: string;
  expiresAt: number; // epoch ms
}

/** Opens Google's sign-in/consent popup and returns an access token. Must be called from a click. */
export async function requestToken(loginHint?: string): Promise<Token> {
  await loadScript("https://accounts.google.com/gsi/client");
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.clientId,
      scope: SCOPES,
      login_hint: loginHint,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, "https://www.googleapis.com/auth/drive.file"))
          return reject(new Error("Google Drive access was not granted. Please allow access to save your maps."));
        resolve({ accessToken: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) - 60) * 1000 });
      },
      error_callback: (err: any) => reject(new Error(err?.type === "popup_closed" ? "Sign-in was cancelled." : err?.message || "Sign-in failed.")),
    });
    client.requestAccessToken({ prompt: loginHint ? "" : "select_account" });
  });
}

export async function fetchUser(token: Token): Promise<GoogleUser> {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!r.ok) throw new Error("Could not read your Google profile.");
  const u = await r.json();
  return { sub: u.sub, email: u.email, name: u.name || u.email, picture: u.picture };
}

export function revokeToken(token: Token) {
  try {
    window.google?.accounts?.oauth2?.revoke(token.accessToken, () => {});
  } catch {
    /* ignore */
  }
}

/** Shows the Google Picker for curriculum map files. Resolves with the picked file ID, or null if cancelled. */
export async function pickFile(token: Token): Promise<string | null> {
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve, reject) =>
    window.gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Could not load Google Picker.")) })
  );
  const picker = window.google.picker;
  return new Promise((resolve) => {
    const shared = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes("application/json").setOwnedByMe(false).setMode(picker.DocsViewMode.LIST);
    const mine = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes("application/json").setOwnedByMe(true).setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder()
      .setTitle("Open a curriculum map (.petemap.json)")
      .addView(shared.setLabel?.("Shared with me") ?? shared)
      .addView(mine.setLabel?.("My Drive") ?? mine)
      .setOAuthToken(token.accessToken)
      .setDeveloperKey(GOOGLE_CONFIG.apiKey)
      .setAppId(GOOGLE_CONFIG.appId)
      .setOrigin(window.location.origin)
      .setCallback((data: any) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs?.[0]?.id ?? null);
        else if (data.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
