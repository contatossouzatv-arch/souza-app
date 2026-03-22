import React from "react";
import { Coins, Gem, ShoppingBag } from "lucide-react";

const currencyMeta = {
  coins: { label: "moedas", Icon: Coins, tone: "text-amber-300" },
  diamonds: { label: "diamantes", Icon: Gem, tone: "text-violet-300" },
};

export default React.memo(function MapStorePanel({ storeSnapshot, onPurchase, feedbackMessage }) {
  if (!storeSnapshot) return null;
  const wallet = storeSnapshot.wallet || { coins: 0, diamonds: 0 };

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Saldo local</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-black text-white">
              <Coins className="h-4 w-4 text-amber-300" />
              {Number(wallet.coins || 0).toLocaleString("pt-BR")}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-sm font-black text-white">
              <Gem className="h-4 w-4 text-violet-300" />
              {Number(wallet.diamonds || 0).toLocaleString("pt-BR")}
            </div>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
          <p className="mt-3 text-sm font-semibold text-white">
            {feedbackMessage || "Compras aqui atualizam o inventario local e ja refletem no loadout e na colecao."}
          </p>
        </div>
      </div>

      {storeSnapshot.sections.map((section) => (
        <div key={section.id} className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{section.title}</p>
              <p className="mt-2 text-sm text-slate-300">{section.description}</p>
            </div>
            <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3 text-cyan-100">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {section.items.map((item) => {
              const meta = currencyMeta[item.price?.currency] || currencyMeta.coins;
              const PriceIcon = meta.Icon;
              return (
                <div key={item.id} className="rounded-[1.4rem] border border-white/10 bg-slate-950/55 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <p className="mt-1 text-[12px] leading-5 text-slate-300">{item.description}</p>
                      {item.slot || item.characterId ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.slot ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                              {item.slot === "preset" ? "Conjunto" : item.slot}
                            </span>
                          ) : null}
                          {item.characterId && item.characterId !== "all" ? (
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                              {item.characterId}
                            </span>
                          ) : null}
                          {item.rarity ? (
                            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                              {item.rarity}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {item.stock > 0 ? (
                      <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                        x{item.stock}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-100">
                      <PriceIcon className={`h-3.5 w-3.5 ${meta.tone}`} />
                      {item.price?.amount > 0 ? `${item.price.amount} ${meta.label}` : "Em breve"}
                    </div>
                    <button
                      type="button"
                      onClick={() => onPurchase?.(item.id)}
                      disabled={item.available === false || item.owned || !item.affordable}
                      className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition active:scale-[0.97] ${
                        item.owned
                          ? "border border-emerald-300/30 bg-emerald-300/12 text-emerald-100"
                          : item.available === false
                            ? "border border-white/10 bg-white/5 text-slate-500"
                            : item.affordable
                              ? "bg-cyan-400 text-slate-950"
                              : "border border-white/10 bg-white/5 text-slate-400"
                      }`}
                    >
                      {item.owned ? "Possui" : item.available === false ? "Em breve" : item.affordable ? "Comprar" : "Sem saldo"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
