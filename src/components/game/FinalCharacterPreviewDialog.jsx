import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImportedModelViewport from "@/components/game/ImportedModelViewport";

export default function FinalCharacterPreviewDialog({
  open,
  onOpenChange,
  modelUrl = "",
  fallbackGeometry = null,
  fallbackMaterial = null,
  modelLabel = "",
}) {
  const hasSourceModel = String(modelUrl || "").trim().length > 0;
  const [viewMode, setViewMode] = React.useState(hasSourceModel ? "final" : "final");
  const [animationInfo, setAnimationInfo] = React.useState({
    available: false,
    count: 0,
    activeName: "",
    source: "fallback",
  });

  React.useEffect(() => {
    if (!open) return;
    setViewMode(hasSourceModel ? "final" : "final");
  }, [hasSourceModel, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[122] bg-slate-950/72 backdrop-blur-sm"
        className="z-[123] flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden border border-cyan-500/35 bg-slate-950 p-0 text-white"
      >
        <DialogHeader className="border-b border-slate-800 px-5 py-4">
          <DialogTitle className="flex items-center justify-between gap-3 text-base font-bold text-cyan-100">
            <span>Preview final do personagem</span>
            <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-300/85">
              {String(modelLabel || "modelo").trim() || "modelo"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1.45fr)_320px]">
          <div className="min-h-0 border-b border-slate-800 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-[11px] text-slate-300">
              <span>
                {viewMode === "source" ? "Original com animacao" : "Final do mapa"}
              </span>
              <span>Gire, arraste e de zoom</span>
            </div>
            <ImportedModelViewport
              className="h-[62dvh] w-full"
              modelUrl={viewMode === "source" ? modelUrl : ""}
              fallbackGeometry={fallbackGeometry}
              fallbackMaterial={fallbackMaterial}
              preferFallback={viewMode !== "source"}
              onAnimationInfo={setAnimationInfo}
            />
          </div>

          <div className="min-h-0 overflow-y-auto px-4 py-4">
            <div className="grid gap-4">
              <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Modos</p>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode("final")}
                    className={`rounded border px-3 py-2 text-[11px] ${
                      viewMode === "final"
                        ? "border-cyan-400 bg-cyan-900/35 text-cyan-100"
                        : "border-slate-700 bg-slate-950 text-slate-300"
                    }`}
                  >
                    Final do mapa
                  </button>
                  {hasSourceModel ? (
                    <button
                      type="button"
                      onClick={() => setViewMode("source")}
                      className={`rounded border px-3 py-2 text-[11px] ${
                        viewMode === "source"
                          ? "border-fuchsia-400 bg-fuchsia-900/35 text-fuchsia-100"
                          : "border-slate-700 bg-slate-950 text-slate-300"
                      }`}
                    >
                      Original com animacao
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Leitura</p>
                <div className="mt-3 grid gap-2 text-[11px] text-slate-300">
                  <p>
                    {viewMode === "source"
                      ? "Esse modo usa o arquivo original importado. Se houver clips, a primeira animacao toca automaticamente."
                      : "Esse modo usa a malha/material atuais do viewport para mostrar como o personagem tende a aparecer no mapa."}
                  </p>
                  <p>
                    {animationInfo.available
                      ? `Animacoes detectadas: ${animationInfo.count}. Clip atual: ${animationInfo.activeName || "primeiro clip"}.`
                      : "Animacao nao detectada para este modo."}
                  </p>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300">
                Scroll aproxima.
                Botao esquerdo gira.
                Botao direito move a camera.
              </div>

              <button
                type="button"
                onClick={() => onOpenChange?.(false)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-200"
              >
                Fechar preview
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
