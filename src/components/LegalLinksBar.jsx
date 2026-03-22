import React from "react";
import { Link } from "react-router-dom";

export default function LegalLinksBar() {
  return (
    <div className="mt-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600">
        <Link to="/termos-de-uso" className="transition-colors hover:text-slate-500">
          Termos de Uso
        </Link>

        <span className="text-slate-700">|</span>

        <Link to="/politica-de-privacidade" className="transition-colors hover:text-slate-500">
          Política de Privacidade
        </Link>
      </div>
    </div>
  );
}
