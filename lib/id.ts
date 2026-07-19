export function createId(prefix: string) {
  const random = crypto.getRandomValues(new Uint32Array(4));
  return `${prefix}_${Date.now().toString(36)}_${Array.from(random, (n) => n.toString(36)).join("")}`;
}
