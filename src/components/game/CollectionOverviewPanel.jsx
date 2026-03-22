import React from "react";
import { Crown, Gift, Shield, Shirt, Sparkles, User2, WandSparkles } from "lucide-react";

const categoryMeta = {
  perks: { label: "Perks", Icon: WandSparkles },
  consumables: { label: "Consumiveis", Icon: Shield },
  skins: { label: "Skins", Icon: Shirt },
  characters: { label: "Personagens", Icon: User2 },
  rewards: { label: "Baus", Icon: Gift },
};

export default React.memo(function CollectionOverviewPanel({ collectionSnapshot, onOpenRewardGallery }) {
  if (!collectionSnapshot) return null;

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[1.6rem] border border-white/10 bg-black/18 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Resumo do inventario</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {collectionSnapshot.categories.map((category) => {
              const meta = categoryMeta[category.id] || categoryMeta.rewards;
              const Icon = meta.Icon;
              let count = 0;
              if (category.id === "perks") count = collectionSnapshot.perks.filter((item) => item.owned).length;
              if (category.id === "consumables") count = collectionSnapshot.consumables.reduce((sum, item) => sum + Number(item.amount || 0), 0);
              if (category.id === "skins") count = collectionSnapshot.skins.filter((item) => item.owned).length;
              if (category.id === "characters") count = collectionSnapshot.characters.filter((item) => item.owned).length;
              if (category.id === "rewards") count = Number(collectionSnapshot.rewardGalleryCount || 0);
              return (
                <div key={category.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-100">
                  <Icon className="h-3.5 w-3.5 text-cyan-200" />
                  {meta.label}: {count}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-black/18 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Galeria de baus</p>
              <p className="mt-2 text-sm text-slate-300">
                {Number(collectionSnapshot.rewardGalleryCount || 0)} recompensas ja coletadas no fluxo final da run.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenRewardGallery}
              className="rounded-full bg-cyan-400 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-950 transition active:scale-[0.97]"
            >
              Ver galeria
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5">
          <div className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5 text-cyan-200" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Perks</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {collectionSnapshot.perks.map((perk) => (
              <div key={perk.id} className="rounded-[1.2rem] border border-white/10 bg-slate-950/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{perk.name}</p>
                    <p className="mt-1 text-[12px] leading-5 text-slate-300">{perk.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${perk.owned ? "border border-emerald-300/30 bg-emerald-300/12 text-emerald-100" : "border border-white/10 bg-white/5 text-slate-400"}`}>
                      {perk.owned ? "Possui" : "Bloqueada"}
                    </span>
                    {perk.equipped ? (
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/12 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                        Equipada
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-200" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Consumiveis</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {collectionSnapshot.consumables.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-white/10 bg-slate-950/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.name}</p>
                    <p className="mt-1 text-[12px] leading-5 text-slate-300">{item.description}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-100">
                    x{Number(item.amount || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5">
          <div className="flex items-center gap-2">
            <Shirt className="h-5 w-5 text-fuchsia-200" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Skins</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {collectionSnapshot.skins.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-white/10 bg-slate-950/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.name}</p>
                    <p className="mt-1 text-[12px] leading-5 text-slate-300">{item.description}</p>
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
                    {Array.isArray(item.equippedBy) && item.equippedBy.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.equippedBy.map((entry) => (
                          <span
                            key={`${item.id}-${entry.characterId}-${entry.slot}`}
                            className="rounded-full border border-emerald-300/30 bg-emerald-300/12 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-100"
                          >
                            Equipada: {entry.characterId} / {entry.slot === "preset" ? "conjunto" : entry.slot}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${item.owned ? "border border-emerald-300/30 bg-emerald-300/12 text-emerald-100" : "border border-white/10 bg-white/5 text-slate-400"}`}>
                    {item.owned ? "Possui" : item.placeholder ? "Placeholder" : "Bloqueada"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5">
          <div className="flex items-center gap-2">
            <User2 className="h-5 w-5 text-emerald-200" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Personagens</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {collectionSnapshot.characters.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-white/10 bg-slate-950/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.name}</p>
                    <p className="mt-1 text-[12px] leading-5 text-slate-300">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.placeholder ? <Sparkles className="h-4 w-4 text-cyan-200" /> : null}
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${item.owned ? "border border-emerald-300/30 bg-emerald-300/12 text-emerald-100" : "border border-white/10 bg-white/5 text-slate-400"}`}>
                      {item.owned ? "Possui" : "Bloqueado"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[1.6rem] border border-white/10 bg-black/18 p-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-200" />
          <p className="text-sm font-black uppercase tracking-[0.16em] text-white">Compatibilidade atual</p>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Perks compradas ja entram no loadout. Consumiveis, skins placeholder e personagens desbloqueados ficam guardados no inventario local e prontos para futuras integracoes maiores.
        </p>
      </div>
    </div>
  );
});
