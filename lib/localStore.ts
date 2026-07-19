"use client";

import { createBlankDocument } from "@/lib/crdt";
import { createId } from "@/lib/id";
import type { DocumentSnapshot, SyncOperation, Version } from "@/types/document";

type LocalState = {
  document: DocumentSnapshot;
  pending: SyncOperation[];
  operations: SyncOperation[];
  versions: Version[];
  token?: string;
  userId: string;
};

const dbName = "house-edtech-editor";
const storeName = "state";
const stateKey = "workspace";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function loadLocalState(): Promise<LocalState> {
  if (!("indexedDB" in window)) {
    return createDefaultState();
  }
  const saved = await withStore<LocalState | undefined>("readonly", (store) => store.get(stateKey));
  return saved ?? createDefaultState();
}

export async function saveLocalState(state: LocalState) {
  if (!("indexedDB" in window)) return;
  await withStore("readwrite", (store) => store.put(state, stateKey));
}

function createDefaultState(): LocalState {
  const userId = localStorage.getItem("demo-user-id") ?? `user_${crypto.randomUUID()}`;
  localStorage.setItem("demo-user-id", userId);
  return {
    document: createBlankDocument(createId("doc")),
    pending: [],
    operations: [],
    versions: [],
    userId
  };
}
