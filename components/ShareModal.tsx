"use client";

import { useState } from "react";
import { Check, Copy, Eye, Pencil, Send, Share2, X } from "lucide-react";

type ShareRole = "EDITOR" | "VIEWER";

type Props = {
  open: boolean;
  documentId: string;
  token?: string;
  onClose: () => void;
  onToast: (message: string) => void;
};

export function ShareModal({ open, documentId, token, onClose, onToast }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("EDITOR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function submit() {
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid registered user email.");
      return;
    }
    if (!token) {
      onToast("Sign in before sharing this document.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/documents/share", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ documentId, email: trimmedEmail, role })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        onToast(payload.details?.join(", ") ?? payload.error ?? "Unable to share document.");
        return;
      }
      if (payload.shareUrl && navigator.clipboard) {
        await navigator.clipboard.writeText(payload.shareUrl).catch(() => undefined);
      }
      setShareUrl(payload.shareUrl ?? "");
      setCopied(Boolean(payload.shareUrl));
      onToast(`${trimmedEmail} was added as ${role.toLowerCase()}.`);
      setEmail("");
    } catch {
      onToast("Unable to reach the share API.");
    } finally {
      setLoading(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    onToast("Share link copied.");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-cedar text-white">
              <Share2 size={20} aria-hidden />
            </div>
            <div>
              <h2 id="share-title" className="text-lg font-bold text-ink">Share document</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Invite a registered user and choose whether they can edit or only view.</p>
            </div>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close share modal">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label className="block text-sm font-medium text-slate-700">
            User email
            <input
              className={`mt-1 h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-cedar ${error ? "border-red-400" : "border-slate-300"}`}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              placeholder="teammate@example.com"
              aria-invalid={Boolean(error)}
            />
            {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Access role</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={`flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold ${role === "EDITOR" ? "border-cedar bg-emerald-50 text-cedar" : "border-slate-300 text-slate-600"}`} onClick={() => setRole("EDITOR")}>
                <Pencil size={16} aria-hidden />
                Editor
              </button>
              <button className={`flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold ${role === "VIEWER" ? "border-cedar bg-emerald-50 text-cedar" : "border-slate-300 text-slate-600"}`} onClick={() => setRole("VIEWER")}>
                <Eye size={16} aria-hidden />
                Viewer
              </button>
            </div>
          </div>

          <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60" onClick={submit} disabled={loading}>
            <Send size={17} aria-hidden />
            {loading ? "Sharing..." : "Share access"}
          </button>

          {shareUrl && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-ink">Share this link with the invited user</p>
              <div className="mt-2 flex gap-2">
                <input className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700" value={shareUrl} readOnly aria-label="Share link" />
                <button className="inline-flex h-10 items-center gap-2 rounded-md bg-cedar px-3 text-sm font-semibold text-white" onClick={copyShareUrl}>
                  {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">Send this to the invited user. They must sign in with the same email you shared access with.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
