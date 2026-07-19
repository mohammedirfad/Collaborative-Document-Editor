import { describe, expect, it } from "vitest";
import { applyOperations, createBlankDocument } from "../lib/crdt";
import type { SyncOperation } from "../types/document";

function op(partial: Partial<SyncOperation>): SyncOperation {
  return {
    id: partial.id ?? crypto.randomUUID(),
    documentId: "doc",
    actorId: partial.actorId ?? "user-a",
    clientId: partial.clientId ?? "client-a",
    kind: partial.kind ?? "UPSERT_BLOCK",
    lamport: partial.lamport ?? 1,
    createdAt: partial.createdAt ?? 1,
    payload: partial.payload ?? { blockId: "block", text: "hello" }
  };
}

describe("deterministic document merge", () => {
  it("produces the same document regardless of operation arrival order", () => {
    const base = createBlankDocument("doc");
    const operations = [
      op({ id: "b", clientId: "client-b", lamport: 2, createdAt: 2, payload: { blockId: "shared", text: "second" } }),
      op({ id: "a", clientId: "client-a", lamport: 1, createdAt: 1, payload: { blockId: "shared", text: "first" } })
    ];

    const forward = applyOperations(base, operations);
    const reverse = applyOperations(base, [...operations].reverse());

    expect(forward).toEqual(reverse);
    expect(forward.blocks.find((block) => block.id === "shared")?.text).toBe("second");
  });

  it("restores a snapshot through a new operation instead of deleting history", () => {
    const base = createBlankDocument("doc");
    const changed = applyOperations(base, [op({ payload: { blockId: "intro", text: "new content" } })]);
    const restored = applyOperations(changed, [
      op({
        id: "restore",
        kind: "RESTORE_SNAPSHOT",
        lamport: 3,
        createdAt: 3,
        payload: { snapshot: base }
      })
    ]);

    expect(restored.blocks[0].text).toContain("Start writing here");
    expect(restored.clock["client-a"]).toBe(3);
  });
});
