export type Role = "OWNER" | "EDITOR" | "VIEWER";

export type ConnectionState = "offline" | "online" | "syncing" | "error";

export type Block = {
  id: string;
  text: string;
  updatedAt: number;
  updatedBy: string;
  version: VectorClock;
  deleted?: boolean;
};

export type VectorClock = Record<string, number>;

export type DocumentSnapshot = {
  id: string;
  title: string;
  blocks: Block[];
  updatedAt: number;
  clock: VectorClock;
};

export type OperationKind = "UPSERT_BLOCK" | "DELETE_BLOCK" | "SET_TITLE" | "RESTORE_SNAPSHOT";

export type SyncOperation = {
  id: string;
  documentId: string;
  actorId: string;
  clientId: string;
  kind: OperationKind;
  lamport: number;
  createdAt: number;
  payload: {
    blockId?: string;
    text?: string;
    title?: string;
    snapshot?: DocumentSnapshot;
  };
};

export type Version = {
  id: string;
  documentId: string;
  label: string;
  createdAt: number;
  createdBy: string;
  snapshot: DocumentSnapshot;
};

export type SyncRequest = {
  documentId: string;
  baseClock: VectorClock;
  operations: SyncOperation[];
};

export type SyncResponse = {
  document: DocumentSnapshot;
  operations: SyncOperation[];
  versions: Version[];
};
