"use client";

import { applyOperations, compactOperations } from "@/lib/crdt";
import { saveLocalState } from "@/lib/localStore";
import type { ConnectionState, DocumentSnapshot, Role, SyncOperation, Version } from "@/types/document";

type EngineState = {
  document: DocumentSnapshot;
  pending: SyncOperation[];
  operations: SyncOperation[];
  versions: Version[];
  token?: string;
  userId: string;
  role?: Role;
};

type EngineListeners = {
  onState: (state: EngineState) => void;
  onConnection: (state: ConnectionState, message?: string) => void;
};

export class SyncEngine {
  private syncing = false;

  constructor(
    private state: EngineState,
    private listeners: EngineListeners
  ) {}

  get snapshot() {
    return this.state;
  }

  async replaceDocument(document: DocumentSnapshot, operations: SyncOperation[] = [], versions: Version[] = [], role?: Role) {
    this.state = {
      ...this.state,
      document,
      operations: compactOperations(operations),
      pending: [],
      versions,
      role: role ?? this.state.role
    };
    await this.persistAndNotify();
    void this.flush();
  }

  async queue(operation: SyncOperation) {
    const operations = compactOperations([...this.state.operations, operation]);
    const pending = compactOperations([...this.state.pending, operation]);
    const document = applyOperations(this.state.document, [operation]);
    this.state = { ...this.state, document, operations, pending };
    await this.persistAndNotify();
    void this.flush();
  }

  async saveVersion(label: string) {
    const version: Version = {
      id: crypto.randomUUID(),
      documentId: this.state.document.id,
      label,
      createdAt: Date.now(),
      createdBy: this.state.userId,
      snapshot: this.state.document
    };
    this.state = { ...this.state, versions: [version, ...this.state.versions] };
    await this.persistAndNotify();

    if (!this.state.token || !navigator.onLine) return;
    await fetch("/api/documents/versions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        documentId: this.state.document.id,
        label,
        snapshot: this.state.document
      })
    });
  }

  async flush() {
    if (this.syncing || !this.state.token || !navigator.onLine) {
      this.listeners.onConnection(navigator.onLine ? "online" : "offline");
      return;
    }

    this.syncing = true;
    this.listeners.onConnection("syncing");

    try {
      const response = await fetch("/api/documents/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
          documentId: this.state.document.id,
          baseClock: this.state.document.clock,
          clientSnapshot: this.state.document,
          operations: this.state.pending
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Sync failed");
      }

      const payload = (await response.json()) as {
        document: DocumentSnapshot;
        operations: SyncOperation[];
        versions: Version[];
        role?: Role;
      };
      this.state = {
        ...this.state,
        document: payload.document,
        operations: compactOperations(payload.operations),
        pending: this.state.pending.length > 0 ? [] : this.state.pending,
        versions: payload.versions,
        role: payload.role ?? this.state.role
      };
      await this.persistAndNotify();
      this.listeners.onConnection("online");
    } catch (error) {
      this.listeners.onConnection("error", error instanceof Error ? error.message : "Sync failed");
    } finally {
      this.syncing = false;
    }
  }

  async replaceAuth(token: string) {
    this.state = { ...this.state, token };
    await this.persistAndNotify();
    void this.flush();
  }

  private async persistAndNotify() {
    this.listeners.onState(this.state);
    await saveLocalState(this.state);
  }
}
