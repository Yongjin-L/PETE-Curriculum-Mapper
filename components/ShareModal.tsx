"use client";

import { useEffect, useState } from "react";
import { renderGridPng } from "@/lib/gridImage";
import { downloadBlob, safeFileBase } from "@/lib/report";
import { makeShareUrl } from "@/lib/sharelink";
import { track } from "@/lib/track";
import type { Plan } from "@/lib/types";
import { Modal } from "./Modal";

export const imageFileName = (plan: Plan) => `${safeFileBase(plan.program.name || plan.program.university || "Curriculum map")} - map.png`;

/** Image actions shared by the Share window and the read-only page. */
export function useGridImage(plan: Plan) {
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    let url = "";
    renderGridPng(plan).then((blob) => {
      url = URL.createObjectURL(blob);
      setImg({ blob, url });
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [plan]);
  const canCopy = typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
  const copy = async () => {
    if (!img) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": img.blob })]);
    track("image_shared");
    return true;
  };
  const download = () => {
    if (!img) return;
    downloadBlob(img.blob, imageFileName(plan));
    track("image_shared");
  };
  return { img, canCopy, copy, download };
}

export function ShareModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "image" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const image = useGridImage(plan);

  useEffect(() => {
    makeShareUrl(plan)
      .then(setUrl)
      .catch(() => setErr("Could not create a link in this browser."));
  }, [plan]);

  const flash = (what: "link" | "image") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Modal title="Share this map" onClose={onClose} wide>
      <section className="share-sec">
        <h3>🔗 View-only link</h3>
        <p className="small muted">
          Anyone with the link can view the map and notes, and download a PDF. No sign-in needed. The link is a snapshot: after you make
          changes, share a new one.
        </p>
        <div className="row">
          <input className="share-url" readOnly value={url ?? "Creating link…"} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
          <button
            className="btn btn-primary"
            disabled={!url}
            onClick={async () => {
              if (!url) return;
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                (document.querySelector(".share-url") as HTMLInputElement | null)?.select();
                document.execCommand?.("copy");
              }
              track("share_link_created");
              flash("link");
            }}
          >
            {copied === "link" ? "Copied ✓" : "Copy link"}
          </button>
          {url && (
            <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
              Preview ↗
            </a>
          )}
        </div>
        {url && url.length > 7000 && (
          <p className="small warn-text">
            This link is long ({url.length.toLocaleString()} characters) because of long notes. Some email apps may cut it off; the image or a PDF
            export is safer there.
          </p>
        )}
        {err && <p className="error-text small">{err}</p>}
      </section>

      <section className="share-sec">
        <h3>🖼 Image of the map</h3>
        <p className="small muted">For slides, emails and posters.</p>
        <div className="share-preview">{image.img ? <img src={image.img.url} alt="Curriculum map image preview" /> : <span className="muted small">Drawing…</span>}</div>
        <div className="row">
          <button className="btn btn-primary" disabled={!image.img} onClick={image.download}>
            ⬇ Download PNG
          </button>
          {image.canCopy && (
            <button
              className="btn"
              disabled={!image.img}
              onClick={async () => {
                try {
                  if (await image.copy()) flash("image");
                } catch {
                  setErr("This browser blocked copying the image. Use Download PNG instead.");
                }
              }}
            >
              {copied === "image" ? "Copied ✓" : "Copy image"}
            </button>
          )}
        </div>
      </section>
    </Modal>
  );
}
