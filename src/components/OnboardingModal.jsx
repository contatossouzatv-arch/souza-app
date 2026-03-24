import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleHelp, ExternalLink, Sparkles } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function OnboardingModal({ open, onComplete }) {
  const [step, setStep] = useState(1);
  const [hasAccount, setHasAccount] = useState(null);
  const [platformId, setPlatformId] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: settings = [] } = useAppSettings();

  const { data: platforms = [] } = useQuery({
    queryKey: ["current-platform-onboarding"],
    queryFn: () => base44.entities.CurrentPlatform.list(),
  });

  const platformLink = settings.find((s) => s.key === "platform_link")?.value || "#";
  const currentPlatform = platforms[0];

  const handleChoice = (choice) => {
    setHasAccount(choice);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!platformId.trim()) {
      alert("Por favor, digite seu ID da plataforma");
      return;
    }

    setLoading(true);
    try {
      const userData = await base44.auth.me();

      await base44.auth.updateMe({
        platform_id: platformId,
        has_platform_account: hasAccount,
        terms_accepted: true,
        privacy_accepted: true,
        onboarding_completed: true,
      });

      try {
        await base44.entities.PlatformHistory.create({
          user_id: userData.id,
          platform_name: currentPlatform?.name || "Plataforma",
          platform_id: platformId.trim(),
          created_at: new Date().toISOString(),
        });
      } catch (error) {
        console.log("Erro ao salvar histórico:", error);
      }

      onComplete();
    } catch (_error) {
      alert("Erro ao salvar. Tente novamente.");
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideClose
        className="sm:max-w-md border-cyan-400/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-center text-2xl font-black text-cyan-200">
            <Sparkles className="h-6 w-6 text-cyan-300" />
            Bem-vindo
          </DialogTitle>
          <p className="mt-1 text-center text-xs text-slate-400">
            {step === 1 ? "Passo 1 de 3" : step === 2 ? "Passo 2 de 3" : "Passo 3 de 3"}
          </p>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5 py-4">
            <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4 text-left">
              <p className="text-sm font-semibold text-amber-100">Aviso importante antes de continuar:</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-200">
                <li>Este app é informativo e promocional.</li>
                <li>Jogos e apostas envolvem risco financeiro.</li>
                <li>Não há promessa ou garantia de ganhos.</li>
                <li>Uso permitido somente para maiores de 18 anos.</li>
              </ul>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800"
                />
                <span>
                  Li e aceito os{" "}
                  <a
                    href="/termos-de-uso"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline underline-offset-2"
                  >
                    Termos de Uso
                  </a>
                  .
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={acceptPrivacy}
                  onChange={(e) => setAcceptPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-800"
                />
                <span>
                  Li e aceito a{" "}
                  <a
                    href="/politica-de-privacidade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline underline-offset-2"
                  >
                    Política de Privacidade
                  </a>
                  .
                </span>
              </label>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!acceptTerms || !acceptPrivacy}
              className="h-11 w-full bg-gradient-to-r from-cyan-500 to-emerald-400 font-bold text-slate-950 hover:from-cyan-400 hover:to-emerald-300"
            >
              Continuar
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 py-4">
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-center">
              <p className="text-base font-semibold text-white">Agora falta só mais um passo rápido.</p>
              <p className="mt-1 text-sm text-slate-300">Você já tem cadastro na plataforma pelo nosso link?</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => handleChoice(true)}
                className="h-12 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-bold text-slate-950 hover:from-emerald-400 hover:to-teal-400"
              >
                <Check className="mr-2 h-5 w-5" />
                Sim, já tenho cadastro
              </Button>

              <Button
                onClick={() => handleChoice(false)}
                className="h-12 w-full border border-cyan-300/40 bg-slate-800 text-base font-bold text-cyan-100 hover:bg-slate-700"
              >
                <CircleHelp className="mr-2 h-5 w-5" />
                Ainda não tenho
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="h-10 w-full border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Voltar
            </Button>
          </div>
        )}

        {step === 3 && hasAccount === true && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4">
              <p className="mb-3 text-sm text-cyan-100">Acesse a plataforma para consultar seu ID:</p>
              <a
                href={platformLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 font-bold text-slate-950 transition-all hover:from-cyan-400 hover:to-blue-400"
              >
                <ExternalLink className="h-5 w-5" />
                Acessar plataforma
              </a>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformId" className="text-cyan-100">
                ID da Plataforma
              </Label>
              <Input
                id="platformId"
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                placeholder="Digite seu ID"
                className="border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-400"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="h-11 w-full bg-gradient-to-r from-cyan-500 to-emerald-400 font-bold text-slate-950 hover:from-cyan-400 hover:to-emerald-300"
            >
              {loading ? "Salvando..." : "Salvar e continuar"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="h-10 w-full border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Voltar
            </Button>
          </div>
        )}

        {step === 3 && hasAccount === false && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-4">
              <p className="mb-3 text-sm text-amber-100">Crie sua conta na plataforma e depois informe seu ID aqui:</p>
              <a
                href={platformLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 font-bold text-slate-950 transition-all hover:from-amber-300 hover:to-orange-300"
              >
                <ExternalLink className="h-5 w-5" />
                Criar conta na plataforma
              </a>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformId" className="text-cyan-100">
                ID da Plataforma
              </Label>
              <Input
                id="platformId"
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                placeholder="Digite seu ID"
                className="border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-400"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="h-11 w-full bg-gradient-to-r from-cyan-500 to-emerald-400 font-bold text-slate-950 hover:from-cyan-400 hover:to-emerald-300"
            >
              {loading ? "Salvando..." : "Confirmar"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="h-10 w-full border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Voltar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
