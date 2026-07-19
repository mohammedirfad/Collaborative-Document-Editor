import type { Block, DocumentSnapshot, SyncOperation, VectorClock } from "@/types/document";

const emptyClock: VectorClock = {};

function compareOp(a: SyncOperation, b: SyncOperation) {
  return (
    a.lamport - b.lamport ||
    a.createdAt - b.createdAt ||
    a.clientId.localeCompare(b.clientId) ||
    a.id.localeCompare(b.id)
  );
}

function compareBlock(a: Block, b: Block) {
  const aLamport = Math.max(...Object.values(a.version), 0);
  const bLamport = Math.max(...Object.values(b.version), 0);
  return aLamport - bLamport || a.updatedAt - b.updatedAt || a.updatedBy.localeCompare(b.updatedBy);
}

export function incrementClock(clock: VectorClock, clientId: string) {
  return { ...clock, [clientId]: (clock[clientId] ?? 0) + 1 };
}

export function mergeClock(a: VectorClock = emptyClock, b: VectorClock = emptyClock) {
  const merged: VectorClock = { ...a };
  for (const [clientId, value] of Object.entries(b)) {
    merged[clientId] = Math.max(merged[clientId] ?? 0, value);
  }
  return merged;
}

export function getLamport(clock: VectorClock) {
  return Math.max(0, ...Object.values(clock));
}

export function createBlankDocument(id = "local-doc"): DocumentSnapshot {
  return {
    id,
    title: "Interview Notes",
    blocks: [
      {
        id: "intro",
        text: "Start writing here. Changes are saved locally first and synced in the background.",
        updatedAt: Date.now(),
        updatedBy: "system",
        version: {}
      }
    ],
    updatedAt: Date.now(),
    clock: {}
  };
}

export function applyOperations(base: DocumentSnapshot, operations: SyncOperation[]): DocumentSnapshot {
  let document: DocumentSnapshot = {
    ...base,
    blocks: base.blocks.map((block) => ({ ...block, version: { ...block.version } })),
    clock: { ...base.clock }
  };

  for (const operation of [...operations].sort(compareOp)) {
    const opClock = { [operation.clientId]: operation.lamport };
    document.clock = mergeClock(document.clock, opClock);
    document.updatedAt = Math.max(document.updatedAt, operation.createdAt);

    if (operation.kind === "SET_TITLE" && operation.payload.title) {
      document = { ...document, title: operation.payload.title.slice(0, 120) };
    }

    if (operation.kind === "RESTORE_SNAPSHOT" && operation.payload.snapshot) {
      const restored = operation.payload.snapshot;
      document = {
        ...restored,
        id: document.id,
        updatedAt: operation.createdAt,
        clock: mergeClock(restored.clock, document.clock)
      };
    }

    if (operation.kind === "UPSERT_BLOCK" && operation.payload.blockId) {
      const incoming: Block = {
        id: operation.payload.blockId,
        text: operation.payload.text ?? "",
        updatedAt: operation.createdAt,
        updatedBy: operation.actorId,
        version: opClock
      };
      const existing = document.blocks.find((block) => block.id === incoming.id);
      if (!existing) {
        document.blocks = [...document.blocks, incoming];
      } else if (compareBlock(existing, incoming) <= 0) {
        document.blocks = document.blocks.map((block) => (block.id === incoming.id ? incoming : block));
      }
    }

    if (operation.kind === "DELETE_BLOCK" && operation.payload.blockId) {
      document.blocks = document.blocks.map((block) =>
        block.id === operation.payload.blockId
          ? { ...block, deleted: true, updatedAt: operation.createdAt, updatedBy: operation.actorId, version: opClock }
          : block
      );
    }
  }

  return {
    ...document,
    blocks: document.blocks.filter((block) => !block.deleted)
  };
}

export function compactOperations(operations: SyncOperation[]) {
  const seen = new Set<string>();
  return [...operations]
    .sort(compareOp)
    .filter((operation) => {
      if (seen.has(operation.id)) return false;
      seen.add(operation.id);
      return true;
    });
}
