import React from "react";

export default function TechLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-9 h-9 border-4 border-slate-700 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-sm text-slate-300">Carregando...</p>
      </div>
    </div>
  );
}
