"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import { createPlanFile, downloadFile, DriveError, getFileMeta, listPlanFiles, updatePlanFile, type DriveFile } from "@/lib/drive";
import { fetchUser, googleConfigured, pickerConfigured, pickFile, requestToken, revokeToken, type GoogleUser, type Token } from "@/lib/google";
import { contentKey, sameContent } from "@/lib/merge";
import { emptyPlan, normalizePlan, type Action } from "@/lib/plan";
import type { Plan } from "@/lib/types";

const DRIVE_KEY = "petemap:drive:v1";
const AUTOSAVE_MS = 2000;
const POLL_MS = 45000;

export interface Link {
  fileId: string;
  name: string; // file name in Drive when we last saw it
  autoName: string; // name this app last gave the file (rename only if the user hasn't renamed it)
  version: string;
  modifiedTime: string;
  webViewLink?: string;
  lastEditor?: string;
  ownerEmail?: string;
  canEdit: boolean;
  base: Plan; // content as of the last load/save, for change detection and merging
}

export type Status = "off" | "signed-out" | "reconnect" | "unlinked" | "saving" | "saved" | "conflict" | "readonly" | "error" | "offline";

export interface Conflict {
  base: Plan;
  mine: Plan;
  theirs: Plan;
  meta: DriveFile;
}

interface Stored {
  user: GoogleUser | null;
  link: Link | null;
}

function readStored(): Stored {
  try {
    const s = JSON.parse(localStorage.getItem(DRIVE_KEY) ?? "null");
    if (s && typeof s === "object") return { user: s.user ?? null, link: s.link ? { ...s.link, base: normalizePlan(s.link.base) } : null };
  } catch {
    /* ignore */
  }
  return { user: null, link: null };
}

function writeStored(s: Stored) {
  try {
    localStorage.setItem(DRIVE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function fileNameFor(plan: Plan): string {
  const base = (plan.program.name || plan.program.university || "Untitled curriculum map").replace(/[\\/:*?"<>|]+/g, " ").trim();
  return `${base}.petemap.json`;
}

const hasContent = (p: Plan) => p.courses.length > 0 || !!p.program.name || !!p.program.university || p.customTopics.length > 0;
const editorName = (m: DriveFile) => m.lastModifyingUser?.displayName || m.lastModifyingUser?.emailAddress || "someone";

function linkFrom(meta: DriveFile, base: Plan, autoName?: string): Link {
  return {
    fileId: meta.id,
    name: meta.name,
    autoName: autoName ?? meta.name,
    version: meta.version,
    modifiedTime: meta.modifiedTime,
    webViewLink: meta.webViewLink,
    lastEditor: meta.lastModifyingUser?.displayName || meta.lastModifyingUser?.emailAddress,
    ownerEmail: meta.owners?.[0]?.emailAddress,
    canEdit: meta.capabilities?.canEdit !== false,
    base,
  };
}

export function useDrive({ plan, loaded, dispatch, toast }: { plan: Plan; loaded: boolean; dispatch: Dispatch<Action>; toast: (m: string) => void }) {
  const enabled = googleConfigured();
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [link, setLinkState] = useState<Link | null>(null);
  const [status, setStatus] = useState<Status>(enabled ? "signed-out" : "off");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [mapsOpen, setMapsOpen] = useState(false);

  const tokenRef = useRef<Token | null>(null);
  const planRef = useRef(plan);
  const linkRef = useRef<Link | null>(null);
  const userRef = useRef<GoogleUser | null>(null);
  const conflictRef = useRef<Conflict | null>(null);
  const busyRef = useRef(false);
  const againRef = useRef(false);
  const autoCreateRef = useRef(false);
  planRef.current = plan;

  const setLink = useCallback((l: Link | null) => {
    linkRef.current = l;
    setLinkState(l);
    writeStored({ user: userRef.current, link: l });
  }, []);

  const setConflictBoth = (c: Conflict | null) => {
    conflictRef.current = c;
    setConflict(c);
  };

  // Restore the remembered account and linked file (the token itself is never stored).
  useEffect(() => {
    if (!enabled) return;
    const s = readStored();
    userRef.current = s.user;
    setUser(s.user);
    linkRef.current = s.link;
    setLinkState(s.link);
    setStatus(s.user ? "reconnect" : "signed-out");
  }, [enabled]);

  const validToken = (): Token | null => {
    const t = tokenRef.current;
    if (t && t.expiresAt > Date.now()) return t;
    if (t) {
      tokenRef.current = null;
      setStatus("reconnect");
    }
    return null;
  };

  const fail = useCallback((e: unknown) => {
    if (e instanceof DriveError && e.status === 401) {
      tokenRef.current = null;
      setStatus("reconnect");
      return;
    }
    if (e instanceof DriveError && (e.status === 403 || e.status === 404)) {
      setStatus("error");
      setError(
        e.status === 404
          ? "This map can no longer be found in Google Drive. It may have been deleted, or it is no longer shared with you."
          : `Google Drive refused access: ${e.message}`
      );
      return;
    }
    if (e instanceof TypeError) {
      setStatus("offline");
      setError("You appear to be offline. Changes are kept in this browser and will be saved to Drive when you reconnect.");
      return;
    }
    setStatus("error");
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  const statusForLink = (l: Link | null) => (!l ? "unlinked" : l.canEdit ? "saved" : "readonly");

  const applyRemote = useCallback(
    (theirs: Plan, meta: DriveFile) => {
      const l = linkRef.current;
      setLink(linkFrom(meta, theirs, l?.autoName));
      dispatch({ type: "replacePlan", plan: theirs });
    },
    [dispatch, setLink]
  );

  const upload = useCallback(
    async (token: Token, content: Plan, meta?: DriveFile) => {
      const l = linkRef.current!;
      setStatus("saving");
      const desired = fileNameFor(content);
      const currentName = meta?.name ?? l.name;
      const rename = currentName === l.autoName && desired !== currentName ? desired : null;
      const saved = await updatePlanFile(token, l.fileId, rename, JSON.stringify(content, null, 2));
      setLink(linkFrom(saved, content, rename ?? l.autoName));
      setError(null);
      setStatus(statusForLink(linkRef.current));
    },
    [setLink]
  );

  const createFile = useCallback(async () => {
    const token = validToken();
    if (!token) return;
    const content = planRef.current;
    try {
      setStatus("saving");
      const name = fileNameFor(content);
      const meta = await createPlanFile(token, name, JSON.stringify(content, null, 2));
      autoCreateRef.current = false;
      setLink(linkFrom(meta, content, name));
      setError(null);
      setStatus("saved");
      toast(`Saved to Google Drive as "${meta.name}" (folder: PETE Curriculum Mapper).`);
    } catch (e) {
      fail(e);
    }
  }, [fail, setLink, toast]);

  /** Compare local and Drive copies and save, load or flag a conflict. */
  const sync = useCallback(async () => {
    const token = validToken();
    const l = linkRef.current;
    if (!token || conflictRef.current) return;
    if (!l) {
      if (autoCreateRef.current && hasContent(planRef.current)) await createFile();
      return;
    }
    if (busyRef.current) {
      againRef.current = true;
      return;
    }
    busyRef.current = true;
    try {
      const meta = await getFileMeta(token, l.fileId);
      if (meta.trashed) throw new DriveError("trashed", 404);
      const mine = planRef.current;
      const localChanged = !sameContent(mine, l.base);
      let theirs: Plan | null = null;

      if (meta.version !== l.version) {
        theirs = normalizePlan(await downloadFile(token, l.fileId));
        if (sameContent(theirs, l.base)) {
          // Only metadata changed (e.g. sharing settings); not a real conflict.
          setLink({ ...linkFrom(meta, l.base, l.autoName) });
          theirs = null;
        }
      }

      if (theirs) {
        if (!localChanged) {
          applyRemote(theirs, meta);
          toast(`Loaded the latest changes by ${editorName(meta)}.`);
          setStatus(statusForLink(linkRef.current));
        } else {
          setConflictBoth({ base: l.base, mine, theirs, meta });
          setStatus("conflict");
        }
      } else if (localChanged) {
        if (meta.capabilities?.canEdit === false) {
          setLink({ ...linkRef.current!, canEdit: false });
          setStatus("readonly");
        } else await upload(token, mine, meta);
      } else {
        setError(null);
        setStatus(statusForLink(linkRef.current));
      }
    } catch (e) {
      fail(e);
    } finally {
      busyRef.current = false;
      if (againRef.current) {
        againRef.current = false;
        void sync();
      }
    }
  }, [applyRemote, createFile, fail, setLink, toast, upload]);

  // Autosave shortly after each change.
  const key = loaded ? contentKey(plan) : "";
  useEffect(() => {
    if (!loaded || !tokenRef.current) return;
    const t = setTimeout(() => void sync(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [key, loaded, sync]);

  // Check for colleagues' changes periodically and when the tab regains focus.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => document.visibilityState === "visible" && tokenRef.current && void sync();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, sync]);

  const signIn = useCallback(async () => {
    try {
      const token = await requestToken(userRef.current?.email);
      const u = await fetchUser(token);
      tokenRef.current = token;
      const previous = userRef.current;
      userRef.current = u;
      setUser(u);
      if (previous && previous.sub !== u.sub) setLink(null); // different account: forget the other account's file
      else writeStored({ user: u, link: linkRef.current });
      setError(null);
      if (linkRef.current) {
        setStatus("saved");
        await sync();
      } else {
        setStatus("unlinked");
        setMapsOpen(true);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sign-in failed.");
    }
  }, [setLink, sync, toast]);

  const signOut = useCallback(() => {
    const removeLocal = confirm(
      "Signed out. Do you also want to remove the current map from this browser?\n\nChoose OK on a shared or public computer. Your Google Drive copy is not affected."
    );
    if (tokenRef.current) revokeToken(tokenRef.current);
    tokenRef.current = null;
    userRef.current = null;
    setUser(null);
    setLink(null);
    setConflictBoth(null);
    setStatus("signed-out");
    setError(null);
    if (removeLocal) dispatch({ type: "replacePlan", plan: emptyPlan() });
  }, [dispatch, setLink]);

  const openFile = useCallback(
    async (fileId: string) => {
      const token = validToken();
      if (!token) return;
      const current = planRef.current;
      const l = linkRef.current;
      if (l?.fileId === fileId) {
        setMapsOpen(false);
        return;
      }
      if (!l && hasContent(current) && !confirm("Your current map is not saved to Google Drive. Open the other map anyway? (Use Download JSON first to keep it.)"))
        return;
      try {
        if (l && !sameContent(current, l.base)) await sync(); // save pending edits to the old file first
        if (conflictRef.current) return;
        const [meta, raw] = await Promise.all([getFileMeta(token, fileId), downloadFile(token, fileId)]);
        const theirs = normalizePlan(raw);
        autoCreateRef.current = false;
        setLink(linkFrom(meta, theirs));
        dispatch({ type: "replacePlan", plan: theirs });
        setStatus(statusForLink(linkRef.current));
        setError(null);
        setMapsOpen(false);
        toast(`Opened "${meta.name}" from Google Drive.`);
      } catch (e) {
        if (e instanceof Error && /schemaVersion|Not a plan/.test(e.message)) toast("That file is not a PETE Curriculum Mapper map.");
        else fail(e);
      }
    },
    [dispatch, fail, setLink, sync, toast]
  );

  const openPicker = useCallback(async () => {
    const token = validToken();
    if (!token) return;
    try {
      const id = await pickFile(token);
      if (id) await openFile(id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not open Google Picker.");
    }
  }, [openFile, toast]);

  const listFiles = useCallback(async () => {
    const token = validToken();
    if (!token) return [];
    return listPlanFiles(token);
  }, []);

  /** Detach from the Drive file (after New map / Import). If signed in, the new map gets its own Drive file once it has content. */
  const detach = useCallback(() => {
    setLink(null);
    setConflictBoth(null);
    setError(null);
    if (tokenRef.current) {
      autoCreateRef.current = true;
      setStatus("unlinked");
    }
  }, [setLink]);

  const resolveConflict = useCallback(
    async (choice: "both" | "mine" | "theirs", merged?: Plan) => {
      const c = conflictRef.current;
      const token = validToken();
      if (!c || !token) return;
      setConflictBoth(null);
      try {
        if (choice === "theirs") {
          applyRemote(c.theirs, c.meta);
          setStatus(statusForLink(linkRef.current));
        } else {
          const content = choice === "both" && merged ? merged : planRef.current;
          if (choice === "both") dispatch({ type: "replacePlan", plan: content });
          linkRef.current = { ...linkRef.current!, version: c.meta.version };
          await upload(token, content, c.meta);
        }
      } catch (e) {
        fail(e);
      }
    },
    [applyRemote, dispatch, fail, upload]
  );

  const saveAsNew = useCallback(async () => {
    setLink(null);
    setError(null);
    await createFile();
  }, [createFile, setLink]);

  return {
    enabled,
    pickerEnabled: pickerConfigured(),
    user,
    link,
    status,
    error,
    conflict,
    mapsOpen,
    setMapsOpen,
    signIn,
    signOut,
    createFile,
    openFile,
    openPicker,
    listFiles,
    detach,
    resolveConflict,
    saveAsNew,
    syncNow: sync,
  };
}

export type DriveApi = ReturnType<typeof useDrive>;
