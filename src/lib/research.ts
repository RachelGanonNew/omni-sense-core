export type ResearchResult = {
  source: "google" | "wikipedia" | "local" | "none";
  title?: string;
  description?: string;
  extract?: string;
  url?: string;
  // For Google results, include top results list
  results?: Array<{ title: string; link: string; snippet?: string; displayLink?: string }>;
  summary?: string;
};

export interface ResearchProvider {
  enrichPerson(name: string): Promise<ResearchResult>;
}

async function googleSearch(name: string): Promise<ResearchResult | null> {
  const key = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return null;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("q", name);
  url.searchParams.set("num", "3");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const j: any = await res.json();
  const items: any[] = Array.isArray(j.items) ? j.items.slice(0, 3) : [];
  if (items.length === 0) return null;
  const results = items.map((it) => ({ title: it.title, link: it.link, snippet: it.snippet, displayLink: it.displayLink }));
  const summary = results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet || ""}`).join("\n");
  return { source: "google", results, summary };
}

async function wikipediaSummary(name: string): Promise<ResearchResult | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const j = await res.json();
  return {
    source: "wikipedia",
    title: j.title,
    description: j.description,
    extract: j.extract,
    url: j.content_urls?.desktop?.page || j.content_urls?.mobile?.page,
  } as ResearchResult;
}

export class SmartResearchProvider implements ResearchProvider {
  async enrichPerson(name: string): Promise<ResearchResult> {
    // Prefer Google Search if configured, otherwise try Wikipedia
    const g = await googleSearch(name).catch(() => null);
    if (g) return g;
    const w = await wikipediaSummary(name).catch(() => null);
    if (w) return w;
    return { source: "none" };
  }
}

export function createResearchProvider(): ResearchProvider {
  return new SmartResearchProvider();
}
