// Lightweight BM25 retrieval over policy sections (filtered to one plan).

export interface PolicyChunk {
  section: string;
  title: string;
  body: string;
  item_id: string | null;
}

const STOP = new Set("a an the of for to and or is are be in on with this that it your you at by as".split(" "));

export function tokenize(t: string): string[] {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9$.\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

/** Rank chunks with BM25. Chunks tied to a different item are excluded. */
export function retrieve(chunks: PolicyChunk[], query: string, itemId: string | null, k = 4): PolicyChunk[] {
  const pool = chunks.filter((c) => c.item_id === null || c.item_id === itemId);
  const docs = pool.map((c) => tokenize(`${c.title} ${c.body}`));
  const N = docs.length || 1;
  const avg = docs.reduce((s, d) => s + d.length, 0) / N || 1;
  const q = tokenize(query);
  const k1 = 1.5;
  const b = 0.75;
  const scored = pool.map((c, i) => {
    const d = docs[i]!;
    let score = 0;
    for (const term of q) {
      const n = docs.filter((x) => x.includes(term)).length;
      if (!n) continue;
      const tf = d.filter((w) => w === term).length;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.length) / avg)));
    }
    if (itemId && c.item_id === itemId) score += 5; // item-specific rule always relevant
    return { c, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.c)
    .sort((a, b) => a.section.localeCompare(b.section));
}

/** Join chunks into a labeled context, stopping at a character budget. */
export function buildContext(chunks: PolicyChunk[], budget = 3000): string {
  let out = "";
  for (const c of chunks) {
    const line = `[Section ${c.section} — ${c.title}] ${c.body}\n`;
    if (out.length + line.length > budget) break;
    out += line;
  }
  return out;
}
