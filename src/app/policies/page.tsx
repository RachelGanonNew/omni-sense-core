"use client";
import { useEffect, useState } from "react";

export default function PoliciesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [intent, setIntent] = useState("turn-taking facilitator");

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/brain/policies");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "failed");
      setItems(j.items || []);
    } catch (e: any) {
      setMsg(`error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function proposeAndActivate() {
    setMsg("Proposing...");
    try {
      const pr = await fetch("/api/brain/policies/propose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent }) });
      const pj = await pr.json();
      if (!pr.ok) throw new Error(pj?.error || "propose failed");
      const p = pj.proposal;
      const act = await fetch("/api/brain/policies/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      const aj = await act.json();
      if (!act.ok) throw new Error(aj?.error || "activate failed");
      setMsg(`Activated ${p.id}`);
      await refresh();
    } catch (e: any) {
      setMsg(`error: ${e?.message || String(e)}`);
    }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-3 text-2xl font-semibold">Policies</h1>
      <div className="mb-3 flex items-center gap-2">
        <input className="flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700" value={intent} onChange={(e)=>setIntent(e.target.value)} placeholder="Policy intent (e.g., conflict facilitation)" />
        <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900" onClick={proposeAndActivate}>Propose + Activate</button>
        <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700" onClick={refresh} disabled={loading}>{loading?"Loading...":"Refresh"}</button>
      </div>
      {msg && <div className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">{msg}</div>}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-4 gap-2 border-b border-zinc-200 p-2 text-xs font-medium dark:border-zinc-800">
          <div>ID</div>
          <div>Intent</div>
          <div>TTL</div>
          <div>Stats</div>
        </div>
        {(items||[]).slice(-50).reverse().map((p:any)=> (
          <div key={p.id} className="grid grid-cols-4 gap-2 border-b border-zinc-200 p-2 text-xs dark:border-zinc-800">
            <div className="truncate" title={p.id}>{p.id}</div>
            <div className="truncate" title={p.intent}>{p.intent}</div>
            <div>{Math.max(0, Math.floor((p.expiresAt - Date.now())/60000))}m left</div>
            <div>{p.fireCount||0} fires{p.lastFiredAt?`, last ${new Date(p.lastFiredAt).toLocaleTimeString()}`:""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
