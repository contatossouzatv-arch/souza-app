import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, HeartHandshake, Info, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function TermsModal({ open, onAccept }) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!accepted) {
      alert("Você precisa concordar com os termos para continuar");
      return;
    }

    setLoading(true);
    try {
      await base44.auth.updateMe({ terms_accepted: true });
      onAccept();
    } catch (error) {
      console.error("Erro ao aceitar termos:", error);
      alert("Erro ao salvar. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center text-2xl font-bold text-emerald-300">
            <HeartHandshake className="h-7 w-7" />
            Termos de Uso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-center text-base font-semibold text-emerald-200">
              Queremos que sua experiencia aqui seja leve, segura e consciente.
            </p>
            <p className="mt-2 text-center text-sm text-slate-200">
              Antes de continuar, leia os pontos principais abaixo.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
              <p className="text-slate-200">
                Não existe garantia de ganhos, resultados ou lucros em apostas online.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
              <p className="text-slate-200">Conteudo exclusivo para maiores de 18 anos.</p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
              <p className="text-slate-200">
                Jogue com responsabilidade e somente com valores que não comprometam sua renda e bem-estar.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
              <p className="text-slate-200">
                Este app não representa recomendação financeira nem promessa de retorno.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/35 bg-slate-800/70 p-4">
            <Checkbox
              id="terms"
              checked={accepted}
              onCheckedChange={setAccepted}
              className="mt-1 border-emerald-400 data-[state=checked]:bg-emerald-500"
            />
            <label htmlFor="terms" className="flex-1 cursor-pointer text-sm text-slate-200">
              Confirmo que sou maior de 18 anos, li e aceito os Termos de Uso.
            </label>
          </div>

          <Button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 py-4 text-base font-bold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
          >
            {loading ? (
              "Salvando..."
            ) : (
              <>
                <Check className="mr-2 h-5 w-5" />
                Concordar e Continuar
              </>
            )}
          </Button>

          <p className="text-center text-xs text-slate-400">
            Ao continuar, você confirma que vai usar o aplicativo de forma responsável.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
