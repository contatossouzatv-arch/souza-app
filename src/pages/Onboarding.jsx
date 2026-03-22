import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Check, CircleHelp, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import caricaturaSouza from "../../assets-para-app/13a71c5e4_caricatura-001.png";
import profileCoverTile from "../../assets-para-app/profile-cover-tile.png";

const stepTitles = {
  1: "Regras e segurança",
  2: "Conta na plataforma",
  3: "Confirmação do seu ID",
};

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_m, ddd, p1, p2) =>
      p2 ? `(${ddd}) ${p1}-${p2}` : p1 ? `(${ddd}) ${p1}` : `(${ddd}`
    );
  }
  return digits.replace(/(\d{2})(\d{0,5})(\d{0,4})/, (_m, ddd, p1, p2) =>
    p2 ? `(${ddd}) ${p1}-${p2}` : p1 ? `(${ddd}) ${p1}` : `(${ddd}`
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { checkAppState, user } = useAuth();
  const [step, setStep] = useState(1);
  const [hasAccount, setHasAccount] = useState(null);
  const [platformId, setPlatformId] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ["onboarding-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ["current-platform-onboarding"],
    queryFn: () => base44.entities.CurrentPlatform.list(),
  });

  const platformLink = settings.find((s) => s.key === "platform_link")?.value || "#";
  const currentPlatform = platforms[0];
  const phoneMissing = !String(user?.phone || "").trim();

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  const handleChoice = (choice) => {
    setHasAccount(choice);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!platformId.trim()) {
      alert("Por favor, digite seu ID da plataforma");
      return;
    }

    if (phoneMissing && !String(phone || "").trim()) {
      alert("Telefone obrigatório para continuar");
      return;
    }

    setLoading(true);
    try {
      const userData = await base44.auth.me();
      await base44.auth.updateMe({
        platform_id: platformId,
        has_platform_account: hasAccount,
        phone: phoneMissing ? phone.trim() : user?.phone,
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

      await checkAppState();
      navigate("/", { replace: true });
    } catch (_error) {
      alert("Erro ao salvar. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url(${profileCoverTile})`,
            backgroundSize: "420px",
            backgroundRepeat: "repeat",
          }}
        />
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-24 top-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center p-4 md:p-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr,1fr]">
          <section className="hidden rounded-3xl border border-cyan-300/20 bg-slate-900/55 p-7 backdrop-blur-xl lg:block">
            <div className="space-y-5">
              <div className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                Comunidade do Souza
              </div>
              <h1 className="text-4xl font-black leading-tight text-white">Falta muito pouco para liberar seu acesso</h1>
              <p className="text-slate-300">Finalize este passo a passo para entrar no app com tudo configurado e com acesso completo.</p>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <img src={caricaturaSouza} alt="Souza" className="mx-auto h-40 w-40 rounded-2xl object-cover" />
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Processo rápido e obrigatório</p>
                <p className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-300" /> Em 3 passos você já entra no app</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-cyan-300/25 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl sm:p-6">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <span>Passo {step} de 3</span>
                <span>{stepTitles[step]}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  animate={{ width: `${(step / 3) * 100}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4">
                    <p className="text-sm font-semibold text-amber-100">Aviso importante antes de continuar</p>
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
                        Li e aceito os <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-2">Termos de Uso</a>.
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
                        Li e aceito a <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-2">Política de Privacidade</a>.
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
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-center">
                    <p className="text-base font-semibold text-white">Você já tem cadastro na plataforma pelo nosso link?</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button onClick={() => handleChoice(true)} className="h-12 w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-bold text-slate-950 hover:from-emerald-400 hover:to-teal-400">
                      <Check className="mr-2 h-5 w-5" /> Sim, já tenho cadastro
                    </Button>

                    <Button onClick={() => handleChoice(false)} className="h-12 w-full border border-cyan-300/40 bg-slate-800 text-base font-bold text-cyan-100 hover:bg-slate-700">
                      <CircleHelp className="mr-2 h-5 w-5" /> Ainda não tenho
                    </Button>
                  </div>

                  <Button variant="outline" onClick={() => setStep(1)} className="h-10 w-full border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800">
                    Voltar
                  </Button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4">
                    <p className="mb-3 text-sm text-cyan-100">
                      {hasAccount
                        ? "Acesse a plataforma para consultar seu ID:"
                        : "Crie sua conta na plataforma e depois informe seu ID aqui:"}
                    </p>
                    <a
                      href={platformLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-bold text-slate-950 transition-all ${
                        hasAccount
                          ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400"
                          : "bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300"
                      }`}
                    >
                      <ExternalLink className="h-5 w-5" />
                      {hasAccount ? "Acessar plataforma" : "Criar conta na plataforma"}
                    </a>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platformId" className="text-cyan-100">ID da Plataforma</Label>
                    <Input
                      id="platformId"
                      value={platformId}
                      onChange={(e) => setPlatformId(e.target.value)}
                      placeholder="Digite seu ID"
                      className="border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-400"
                    />
                  </div>

                  {phoneMissing ? (
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-cyan-100">Telefone (obrigatório)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="border-slate-600 bg-slate-800/80 text-white placeholder:text-slate-400"
                        required
                        maxLength={15}
                      />
                    </div>
                  ) : null}

                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="h-11 w-full bg-gradient-to-r from-cyan-500 to-emerald-400 font-bold text-slate-950 hover:from-cyan-400 hover:to-emerald-300"
                  >
                    {loading ? "Salvando..." : "Concluir e entrar"}
                  </Button>

                  <Button variant="outline" onClick={() => setStep(2)} className="h-10 w-full border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800">
                    Voltar
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </div>
  );
}
