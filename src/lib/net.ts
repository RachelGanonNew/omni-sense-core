export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; backoffMs?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const retries = opts.retries ?? 4;
  const backoffMs = opts.backoffMs ?? 800;
  const timeoutMs = opts.timeoutMs ?? 12000;

  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok && res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(to);
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("fetchWithRetry failed");
}
