"use client";

import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { uid } from "@/lib/utils";

type Toast = { id: string; type: "success" | "error"; message: string };
type ToastContextValue = { success: (message: string) => void; error: (message: string) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], message: string) => {
    const id = uid("toast");
    setItems((list) => [...list, { id, type, message }]);
    window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ success: (m: string) => push("success", m), error: (m: string) => push("error", m) }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[70] flex w-[min(92vw,420px)] flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className={`flex items-start gap-3 rounded-xl border p-4 shadow-2xl ${item.type === "success" ? "border-lime/30 bg-[#111b0b]" : "border-red-500/30 bg-[#211015]"}`}>
            {item.type === "success" ? <CheckCircle2 className="mt-0.5 text-lime" size={20} /> : <AlertTriangle className="mt-0.5 text-red-400" size={20} />}
            <p className="flex-1 text-sm font-medium text-white">{item.message}</p>
            <button onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))}><X size={16} className="text-slate-400" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast precisa estar dentro de ToastProvider.");
  return value;
}
