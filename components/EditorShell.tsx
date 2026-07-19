"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bot, Cloud, CloudOff, FileText, History, LockKeyhole, Menu, Plus, RotateCcw, Save, Share2, ShieldCheck, Trash2, Wifi, X } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { ShareModal } from "@/components/ShareModal";
import { applyOperations, getLamport, incrementClock } from "@/lib/crdt";
import { createId } from "@/lib/id";
import { loadLocalState } from "@/lib/localStore";
import { SyncEngine } from "@/lib/syncEngine";
import type { Block, ConnectionState, DocumentSnapshot, SyncOperation, Version } from "@/types/document";

export function EditorShell() {
  const [document, setDocument] = useState<DocumentSnapshot | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [pending, setPending] = useState(0);
  const [connection, setConnection] = useState<ConnectionState>("offline");
  const [message, setMessage] = useState("Loading local workspace...");
  const [aiSummary, setAiSummary] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const engine = useRef<SyncEngine | null>(null);
  const userId = useRef("local-user");
  const clientId = useMemo(() => (typeof window === "undefined" ? "server" : localStorage.getItem("client-id") ?? createClientId()), []);

  useEffect(() => {
    let mounted = true;
    loadLocalState().then((state) => {
      if (!mounted) return;
      userId.current = state.userId;
      setDocument(state.document);
      setVersions(state.versions);
      setPending(state.pending.length);
      setIsSignedIn(Boolean(state.token));
      setToken(state.token);
      engine.current = new SyncEngine(state, {
        onState: (next) => {
          setDocument(next.document);
          setVersions(next.versions);
          setPending(next.pending.length);
        },
        onConnection: (next, detail) => {
          setConnection(next);
          setMessage(detail ?? describeConnection(next));
        }
      });
      setConnection(navigator.onLine ? "online" : "offline");
      setMessage(describeConnection(navigator.onLine ? "online" : "offline"));
      void engine.current.flush();
    });

    const online = () => void engine.current?.flush();
    const offline = () => {
      setConnection("offline");
      setMessage(describeConnection("offline"));
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const refreshTimer = window.setInterval(() => {
      void engine.current?.flush();
    }, 5000);
    return () => {
      mounted = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function operation(kind: SyncOperation["kind"], payload: SyncOperation["payload"]): SyncOperation | null {
    if (!document) return null;
    const clock = incrementClock(document.clock, clientId);
    return {
      id: createId("op"),
      documentId: document.id,
      actorId: userId.current,
      clientId,
      kind,
      lamport: getLamport(clock),
      createdAt: Date.now(),
      payload
    };
  }

  function requireAuth(reason: string) {
    if (isSignedIn) return true;
    setAuthReason(reason);
    setAuthOpen(true);
    return false;
  }

  function updateBlock(block: Block, text: string) {
    if (!requireAuth("Sign in to edit. This protects the shared document from anonymous changes.")) return;
    const next = operation("UPSERT_BLOCK", { blockId: block.id, text });
    if (next) void engine.current?.queue(next);
  }

  function addBlock() {
    if (!requireAuth("Sign in to add a new block to the collaborative document.")) return;
    const next = operation("UPSERT_BLOCK", { blockId: createId("block"), text: "" });
    if (next) void engine.current?.queue(next);
  }

  function deleteBlock(blockId: string) {
    if (!requireAuth("Sign in to delete blocks. Destructive edits must be tied to a user.")) return;
    const next = operation("DELETE_BLOCK", { blockId });
    if (next) void engine.current?.queue(next);
  }

  function rename(title: string) {
    if (!requireAuth("Sign in to rename the document.")) return;
    const next = operation("SET_TITLE", { title });
    if (next) void engine.current?.queue(next);
  }

  function restore(version: Version) {
    if (!requireAuth("Sign in to restore a checkpoint. Restore is saved as a new auditable operation.")) return;
    const next = operation("RESTORE_SNAPSHOT", { snapshot: version.snapshot });
    if (next) void engine.current?.queue(next);
  }

  async function captureVersion() {
    if (!requireAuth("Sign in to capture version checkpoints.")) return;
    const label = `Checkpoint ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    await engine.current?.saveVersion(label);
  }

  function summarize() {
    if (!requireAuth("Sign in to use workspace actions, including AI assist.")) return;
    if (!document) return;
    const text = document.blocks.map((block) => block.text).join(" ").trim();
    const words = text.split(/\s+/).filter(Boolean);
    setAiSummary(
      words.length
        ? `AI assist draft: ${words.slice(0, 28).join(" ")}${words.length > 28 ? "..." : ""}`
        : "AI assist draft: add content and I will summarize the current document locally."
    );
  }

  if (!document) {
    return <main className="grid min-h-screen place-items-center bg-mist text-ink">Opening offline workspace...</main>;
  }

  const syncedDocument = applyOperations(document, []);

  return (
    <main className="min-h-screen bg-mist text-ink">
      <AuthModal
        open={authOpen}
        reason={authReason}
        onClose={() => setAuthOpen(false)}
        onToken={(token) => {
          setIsSignedIn(true);
          setToken(token);
          void engine.current?.replaceAuth(token);
        }}
        onToast={setToast}
      />
      <ShareModal
        open={shareOpen}
        documentId={syncedDocument.id}
        token={token}
        onClose={() => setShareOpen(false)}
        onToast={setToast}
      />
      {toast && <Toast message={toast} onClose={() => setToast("")} />}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ink text-white">
              <FileText size={20} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold sm:text-base">House of Edtech Editor</p>
              <p className="hidden text-xs text-slate-500 sm:block">Offline-first sync, versions, role-aware writes</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <a className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" href="#editor">
              Editor
            </a>
            <a className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" href="#versions">
              Versions
            </a>
            <a className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" href="#how-it-works">
              How it works
            </a>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <StatusBadge state={connection} message={message} pending={pending} compact />
            {isSignedIn ? (
              <span className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">
                <ShieldCheck size={16} aria-hidden />
                Signed in
              </span>
            ) : (
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white" onClick={() => requireAuth("Sign in to start editing and syncing this workspace.")}>
                <LockKeyhole size={16} aria-hidden />
                Sign in
              </button>
            )}
          </div>

          <button className="grid h-10 w-10 place-items-center rounded-md border border-slate-300 lg:hidden" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation">
            {mobileNavOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
        </nav>
        {mobileNavOpen && (
          <div className="border-t border-slate-200 px-4 py-3 lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-2">
              <a className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100" href="#editor" onClick={() => setMobileNavOpen(false)}>
                Editor
              </a>
              <a className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100" href="#versions" onClick={() => setMobileNavOpen(false)}>
                Versions
              </a>
              <a className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100" href="#how-it-works" onClick={() => setMobileNavOpen(false)}>
                How it works
              </a>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <StatusBadge state={connection} message={message} pending={pending} />
                {!isSignedIn && (
                  <button className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white" onClick={() => requireAuth("Sign in to start editing and syncing this workspace.")}>
                    <LockKeyhole size={16} aria-hidden />
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</label>
            <input
              aria-label="Document title"
              className="mt-1 w-full bg-transparent text-2xl font-bold outline-none sm:text-3xl"
              value={syncedDocument.title}
              readOnly={!isSignedIn}
              onFocus={() => !isSignedIn && requireAuth("Sign in to rename the document.")}
              onChange={(event) => rename(event.target.value)}
            />
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Read access is visible immediately for review. Editing, checkpointing, restoring, and syncing require authentication so every operation is accountable.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton label="Capture version" onClick={captureVersion} icon={<Save size={17} />} />
            <IconButton label="Add block" onClick={addBlock} icon={<Plus size={17} />} />
            <IconButton
              label="Share"
              onClick={() => {
                if (!requireAuth("Sign in to share this document.")) return;
                setShareOpen(true);
              }}
              icon={<Share2 size={17} />}
            />
            <IconButton label="AI summary" onClick={summarize} icon={<Bot size={17} />} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section id="editor" className="min-h-[62vh] rounded-md border border-slate-200 bg-white p-3 shadow-soft sm:p-5">
          {!isSignedIn && (
            <div className="mb-4 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-ink">Read-only preview</p>
                <p className="mt-1 text-sm text-slate-600">Sign in to unlock editing, local queueing, server sync, checkpoints, restore, and AI assist.</p>
              </div>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-white" onClick={() => requireAuth("Sign in to edit this shared document.")}>
                <LockKeyhole size={16} aria-hidden />
                Sign in to edit
              </button>
            </div>
          )}
          <div className="space-y-3">
            {syncedDocument.blocks.map((block) => (
              <article key={block.id} className="group grid grid-cols-[1fr_auto] gap-2 rounded-md border border-transparent p-2 focus-within:border-cedar hover:border-slate-200">
                <textarea
                  aria-label="Document block"
                  className="min-h-24 resize-y rounded-md bg-slate-50 px-3 py-3 leading-7 outline-none focus:bg-white disabled:cursor-not-allowed disabled:text-slate-500"
                  value={block.text}
                  readOnly={!isSignedIn}
                  onFocus={() => !isSignedIn && requireAuth("Sign in to edit this block.")}
                  onChange={(event) => updateBlock(block, event.target.value)}
                />
                <button className="h-9 w-9 rounded-md text-slate-400 hover:bg-coral hover:text-white" onClick={() => deleteBlock(block.id)} title="Delete block" aria-label="Delete block">
                  <Trash2 className="mx-auto" size={17} aria-hidden />
                </button>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section id="versions" className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <History size={18} aria-hidden />
              <h2 className="text-base font-semibold">Version History</h2>
            </div>
            <div className="space-y-2">
              {versions.length === 0 && <p className="text-sm text-slate-500">No checkpoints yet.</p>}
              {versions.map((version) => (
                <button key={version.id} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-cedar" onClick={() => restore(version)}>
                  <span>
                    <span className="block font-medium">{version.label}</span>
                    <span className="text-xs text-slate-500">{new Date(version.createdAt).toLocaleString()}</span>
                  </span>
                  <RotateCcw size={15} aria-hidden />
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <Bot size={18} aria-hidden />
              <h2 className="text-base font-semibold">AI Add-on</h2>
            </div>
            <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">{aiSummary || "Use the AI summary button to generate an offline-safe summary draft."}</p>
          </section>

          <section id="how-it-works" className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-base font-semibold">How It Works</h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <p><strong className="text-ink">Local edit:</strong> typing creates an operation and saves it in IndexedDB first, so the UI never waits for the server.</p>
              <p><strong className="text-ink">Number badge:</strong> the yellow number is pending operations waiting to sync.</p>
              <p><strong className="text-ink">Capture version:</strong> saves the current document snapshot as a checkpoint.</p>
              <p><strong className="text-ink">Block:</strong> one editable paragraph unit. Each block can merge independently.</p>
              <p><strong className="text-ink">AI summary:</strong> creates a local summary draft from the current text.</p>
              <p><strong className="text-ink">Checkpoint:</strong> a saved version that can be restored through a new operation, keeping history intact.</p>
            </div>
          </section>
        </aside>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-500">
        Your Name | GitHub: github.com/your-profile | LinkedIn: linkedin.com/in/your-profile
      </footer>
    </main>
  );
}

function createClientId() {
  const id = `client_${crypto.randomUUID()}`;
  localStorage.setItem("client-id", id);
  return id;
}

function describeConnection(state: ConnectionState) {
  if (state === "syncing") return "Syncing queued changes";
  if (state === "error") return "Sync failed, local queue preserved";
  if (state === "online") return "Online, local edits save instantly";
  return "Offline, changes queued locally";
}

function StatusBadge({ state, message, pending, compact = false }: { state: ConnectionState; message: string; pending: number; compact?: boolean }) {
  const icon = state === "offline" ? <CloudOff size={16} /> : state === "syncing" ? <Cloud size={16} /> : <Wifi size={16} />;
  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium" title={message}>
      {icon}
      <span>{compact ? stateLabel(state) : message}</span>
      {pending > 0 && <span className="rounded bg-saffron px-1.5 py-0.5 text-xs text-ink">{pending}</span>}
    </div>
  );
}

function stateLabel(state: ConnectionState) {
  if (state === "syncing") return "Syncing";
  if (state === "error") return "Sync error";
  if (state === "online") return "Online";
  return "Offline";
}

function IconButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold hover:border-cedar hover:text-cedar" onClick={onClick} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed right-4 top-20 z-[60] w-[calc(100vw-2rem)] max-w-sm rounded-md border border-red-200 bg-white p-4 text-sm shadow-soft sm:right-6" role="status">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium leading-6 text-coral">{message}</p>
        <button className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Dismiss message">
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
