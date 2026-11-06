"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DriveFile } from "@/lib/drive";
import { describeChanges, mergePlans } from "@/lib/merge";
import type { Plan } from "@/lib/types";
import { Modal } from "./Modal";
import type { DriveApi } from "./useDrive";

const time = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export function AccountArea({ drive, onShare }: { drive: DriveApi; onShare: () => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const { status, user, link } = drive;

  if (status === "off") return <span className="save-status small">✓ Saved in this browser</span>;

  if (status === "signed-out")
    return (
      <>
        <span className="save-status small">✓ Saved in this browser</span>
        <button className="btn btn-google" onClick={() => drive.signIn()} title="Sign in to save your maps in your own Google Drive">
          <GoogleG /> Sign in to save to Drive
        </button>
      </>
    );

  if (status === "reconnect")
    return (
      <>
        <span className="save-status small">Saved in this browser</span>
        <button className="btn btn-google" onClick={() => drive.signIn()} title="Your Google session ended. Reconnect to keep saving to Drive.">
          <GoogleG /> Reconnect Drive{user ? ` (${user.email})` : ""}
        </button>
      </>
    );

  const statusText: Record<string, { text: string; cls?: string; title?: string }> = {
    saving: { text: "Saving to Drive…" },
    saved: { text: "✓ Saved to Drive", title: link ? `${link.name}\nLast saved ${time(link.modifiedTime)}${link.lastEditor ? ` by ${link.lastEditor}` : ""}` : "" },
    readonly: { text: "View only", cls: "warn", title: "You can view this shared map but not edit it. Ask the owner for edit access." },
    conflict: { text: "⚠ Choose which changes to keep", cls: "warn" },
    error: { text: "⚠ Drive problem", cls: "warn", title: drive.error ?? "" },
    offline: { text: "⚠ Offline: saved in this browser", cls: "warn", title: drive.error ?? "" },
    unlinked: { text: "Not in Drive yet" },
  };
  const s = statusText[status] ?? { text: "" };

  return (
    <>
      <span className={"save-status small" + (s.cls ? " " + s.cls : "")} title={s.title}>
        {s.text}
      </span>
      {status === "unlinked" && (
        <button className="btn btn-primary" onClick={drive.createFile}>
          Save to Drive
        </button>
      )}
      {status === "error" && (
        <button className="btn" onClick={() => alert(drive.error)}>
          Details
        </button>
      )}
      <div className="account" ref={ref}>
        <button className="avatar-btn" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} title={user?.email}>
          {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span>{user?.name?.[0] ?? "?"}</span>}
        </button>
        {menu && (
          <div className="menu" role="menu" onClick={() => setMenu(false)}>
            <div className="menu-user">
              <b>{user?.name}</b>
              <span className="muted small">{user?.email}</span>
            </div>
            <button role="menuitem" onClick={() => drive.setMapsOpen(true)}>
              My maps in Drive…
            </button>
            {link && (
              <button role="menuitem" onClick={onShare}>
                Share with colleagues…
              </button>
            )}
            {link?.webViewLink && (
              <a role="menuitem" href={link.webViewLink} target="_blank" rel="noopener noreferrer">
                Show file in Google Drive ↗
              </a>
            )}
            {status === "error" && (
              <button role="menuitem" onClick={drive.saveAsNew}>
                Save as a new Drive file
              </button>
            )}
            <button role="menuitem" onClick={drive.signOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function MyMapsDialog({ drive, plan, onNewMap }: { drive: DriveApi; plan: Plan; onNewMap: () => void }) {
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { link, user } = drive;
  const hasLocal = plan.courses.length > 0 || !!plan.program.name || !!plan.program.university;

  useEffect(() => {
    drive
      .listFiles()
      .then(setFiles)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="My maps in Google Drive" onClose={() => drive.setMapsOpen(false)} wide>
      {!link && hasLocal && (
        <div className="callout">
          <div>
            <b>Your current map is only in this browser.</b>
            <div className="small muted">Save it to your Google Drive to keep it safe and share it.</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={async () => {
              await drive.createFile();
              drive.setMapsOpen(false);
            }}
          >
            Save current map to Drive
          </button>
        </div>
      )}

      <div className="row between">
        <h3>Maps you can open</h3>
        <div className="row">
          {drive.pickerEnabled && (
            <button className="btn" onClick={drive.openPicker}>
              Open a map shared with me…
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              drive.setMapsOpen(false);
              onNewMap();
            }}
          >
            New map
          </button>
        </div>
      </div>

      {err && <p className="error-text">{err}</p>}
      {!files && !err && <p className="muted">Loading…</p>}
      {files && files.length === 0 && <p className="muted">No maps in your Drive yet.</p>}
      {files && files.length > 0 && (
        <ul className="file-list">
          {files.map((f) => {
            const owner = f.owners?.[0];
            const mine = !owner?.emailAddress || owner.emailAddress === user?.email;
            const current = link?.fileId === f.id;
            return (
              <li key={f.id} className={current ? "current" : ""}>
                <div>
                  <div className="file-name">{f.name.replace(/\.petemap\.json$/, "")}</div>
                  <div className="small muted">
                    Edited {time(f.modifiedTime)}
                    {f.lastModifyingUser?.displayName ? ` by ${f.lastModifyingUser.displayName}` : ""}
                    {!mine && ` · shared by ${owner?.displayName || owner?.emailAddress}`}
                    {f.capabilities?.canEdit === false && " · view only"}
                  </div>
                </div>
                {current ? (
                  <span className="small muted">Open now</span>
                ) : (
                  <button className="btn btn-sm" onClick={() => drive.openFile(f.id)}>
                    Open
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="small muted">
        Maps are saved as files in the <b>PETE Curriculum Mapper</b> folder of your Google Drive. This site can only see files it created or
        that you open here; it cannot see the rest of your Drive.
      </p>
    </Modal>
  );
}

export function ShareDialog({ drive, onClose }: { drive: DriveApi; onClose: () => void }) {
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const message = `I've shared our curriculum map "${drive.link?.name.replace(/\.petemap\.json$/, "")}" with you. To open it: go to ${site}, sign in with Google, open the account menu → "My maps in Drive…" → "Open a map shared with me…", and pick the file.`;
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Share this map with colleagues" onClose={onClose}>
      <ol className="steps">
        <li>
          Open the file in Google Drive and use Drive&apos;s <b>Share</b> button to add your colleagues&apos; email addresses. Give them{" "}
          <b>Editor</b> access if they should be able to make changes.
          <div>
            <a className="btn btn-primary" href={drive.link?.webViewLink} target="_blank" rel="noopener noreferrer">
              Open in Google Drive ↗
            </a>
          </div>
        </li>
        <li>
          Send them this message:
          <textarea readOnly rows={4} value={message} />
          <button
            className="btn btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(message).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied ✓" : "Copy message"}
          </button>
        </li>
      </ol>
      <p className="small muted">
        Everyone edits the same file. The map saves automatically and checks for colleagues&apos; changes about once a minute. If two people change
        it at the same time, you&apos;ll be asked which changes to keep.
      </p>
    </Modal>
  );
}

export function ConflictDialog({ drive }: { drive: DriveApi }) {
  const c = drive.conflict!;
  const merged = useMemo(() => mergePlans(c.base, c.mine, c.theirs), [c]);
  const theirChanges = describeChanges(c.base, c.theirs);
  const myChanges = describeChanges(c.base, c.mine);
  const who = c.meta.lastModifyingUser?.displayName || c.meta.lastModifyingUser?.emailAddress || "A colleague";

  return (
    <Modal title="This map was changed by someone else">
      <p>
        <b>{who}</b> saved changes at {time(c.meta.modifiedTime)} while you were also editing. Choose which changes to keep.
      </p>
      <div className="compare">
        <div>
          <h4>Their changes</h4>
          <ul>
            {theirChanges.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Your changes</h4>
          <ul>
            {myChanges.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="choice-list">
        <button className="btn btn-primary" onClick={() => drive.resolveConflict("both", merged)}>
          Keep both (recommended)
        </button>
        <p className="small muted">Combines everything. If you both changed the same item, your version is used.</p>
        <button className="btn" onClick={() => drive.resolveConflict("mine")}>
          Keep only mine
        </button>
        <button className="btn" onClick={() => drive.resolveConflict("theirs")}>
          Keep only theirs (discard my changes)
        </button>
      </div>
    </Modal>
  );
}
