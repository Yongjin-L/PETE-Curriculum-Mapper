/* Minimal Google Drive v3 REST client for curriculum map files.
 * Uses the drive.file scope: the app can only see files it created or that the user opened with the Picker. */

import type { Token } from "./google";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_NAME = "PETE Curriculum Mapper";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const META_FIELDS = "id,name,version,modifiedTime,webViewLink,lastModifyingUser(displayName,emailAddress),owners(displayName,emailAddress),capabilities(canEdit),trashed";

export interface DriveFile {
  id: string;
  name: string;
  version: string;
  modifiedTime: string;
  webViewLink?: string;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
  owners?: { displayName?: string; emailAddress?: string }[];
  capabilities?: { canEdit?: boolean };
  trashed?: boolean;
}

export class DriveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(token: Token, url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token.accessToken}`, ...(init.headers ?? {}) } });
  if (!r.ok) {
    let msg = `Google Drive error ${r.status}`;
    try {
      const body = await r.json();
      msg = body?.error?.message ?? msg;
    } catch {
      /* ignore */
    }
    throw new DriveError(msg, r.status);
  }
  return (r.status === 204 ? undefined : r.json()) as T;
}

function multipart(metadata: object, content: string) {
  const boundary = "petemap" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  return { body, headers: { "Content-Type": `multipart/related; boundary=${boundary}` } };
}

async function findOrCreateFolder(token: Token): Promise<string> {
  const q = encodeURIComponent(`mimeType='${FOLDER_MIME}' and name='${FOLDER_NAME}' and trashed=false`);
  const found = await call<{ files: { id: string }[] }>(token, `${API}/files?q=${q}&fields=files(id)&pageSize=1`);
  if (found.files[0]) return found.files[0].id;
  const created = await call<{ id: string }>(token, `${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  return created.id;
}

export async function createPlanFile(token: Token, name: string, content: string): Promise<DriveFile> {
  const folder = await findOrCreateFolder(token);
  const { body, headers } = multipart(
    { name, mimeType: "application/json", parents: [folder], appProperties: { petemap: "plan" }, description: "Curriculum map created with PETE Curriculum Mapper" },
    content
  );
  return call<DriveFile>(token, `${UPLOAD}/files?uploadType=multipart&fields=${META_FIELDS}`, { method: "POST", headers, body });
}

export async function updatePlanFile(token: Token, id: string, name: string | null, content: string): Promise<DriveFile> {
  const { body, headers } = multipart(name ? { name } : {}, content);
  return call<DriveFile>(token, `${UPLOAD}/files/${id}?uploadType=multipart&fields=${META_FIELDS}`, { method: "PATCH", headers, body });
}

export function getFileMeta(token: Token, id: string): Promise<DriveFile> {
  return call<DriveFile>(token, `${API}/files/${id}?fields=${META_FIELDS}`);
}

export async function downloadFile(token: Token, id: string): Promise<unknown> {
  return call<unknown>(token, `${API}/files/${id}?alt=media`);
}

/** Curriculum maps this app can see: ones the user created here plus ones opened with the Picker. */
export async function listPlanFiles(token: Token): Promise<DriveFile[]> {
  const q = encodeURIComponent(`appProperties has { key='petemap' and value='plan' } and trashed=false`);
  const r = await call<{ files: DriveFile[] }>(
    token,
    `${API}/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&fields=files(${META_FIELDS})`
  );
  return r.files;
}
