import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, hint, icon: Icon, tone = "brand" }: { label: string; value: string; hint?: string; icon: LucideIcon; tone?: "brand" | "lime" | "violet" | "warning" }) {
  const tones = { brand: "text-brand bg-brand/10 border-brand/20", lime: "text-lime bg-lime/10 border-lime/20", violet: "text-violet-300 bg-violet-500/10 border-violet-500/20", warning: "text-amber-300 bg-amber-500/10 border-amber-500/20" };
  return (
    <div className="stat">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>
        <div className={`rounded-xl border p-2.5 ${tones[tone]}`}><Icon size={20} /></div>
      </div>
    </div>
  );
}
