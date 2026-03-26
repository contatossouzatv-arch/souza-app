import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { Eye, EyeOff } from "lucide-react";
import caricaturaSouza from "../../assets-para-app/13a71c5e4_caricatura-001.png";
import profileCoverTile from "../../assets-para-app/profile-cover-tile.png";
import souzaTitleAnimado from "../../assets-para-app/souza title animado.webm";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const MIN_LOADING_MS = 2000;
const LOGIN_2FA_PENDING_KEY = "souza_login_2fa_pending_v1";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
async function syncAutoCreatorEngagementForCurrentUser() {
  try {
    await base44.social.autoFollowCreator();
  } catch {
    // ignore
  }
  try {
    await base44.social.autoLikeCreator();
  } catch {
    // ignore
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, checkAppState } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotInfo, setForgotInfo] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const googleButtonRef = useRef(null);
  const googleInitializedRef = useRef(false);
  const loginPanelRef = useRef(null);
  const registerPanelRef = useRef(null);
  const [panelHeight, setPanelHeight] = useState(0);

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    full_name: "",
    nick: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const scriptId = "google-gsi-script";
    let script = document.getElementById(scriptId);

    const initGoogle = () => {
      if (!window.google || !googleButtonRef.current || googleInitializedRef.current) return;
      googleInitializedRef.current = true;
      const buttonWidth = Math.min(googleButtonRef.current.clientWidth || 320, 320);
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          const startedAt = Date.now();
          try {
            setLoading(true);
            setError("");
            await base44.auth.loginWithGoogle(response.credential);
            await syncAutoCreatorEngagementForCurrentUser();
            await checkAppState();
            navigate("/");
          } catch (err) {
            const message = String(err?.message || "");
            if (message.toUpperCase().includes("2FA_REQUIRED")) {
              try {
                window.sessionStorage.setItem(
                  LOGIN_2FA_PENDING_KEY,
                  JSON.stringify({
                    provider: "google",
                    credential: response.credential,
                    email: "",
                    created_at: Date.now(),
                  })
                );
              } catch {
                // ignore sessionStorage errors
              }
              navigate("/login-2fa");
              return;
            }
            setError(message || "Falha ao entrar com Google");
          } finally {
            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_LOADING_MS) {
              await wait(MIN_LOADING_MS - elapsed);
            }
            setLoadingProgress(100);
            await wait(120);
            setLoading(false);
          }
        },
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: buttonWidth,
      });
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else if (window.google) {
      initGoogle();
    }
  }, [checkAppState, navigate]);

  useEffect(() => {
    if (!loading) return;

    const startedAt = Date.now();
    setLoadingProgress(0);

    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(95, Math.floor((elapsed / MIN_LOADING_MS) * 100));
      setLoadingProgress(pct);
    }, 40);

    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    const updatePanelHeight = () => {
      const activeRef = activeTab === "login" ? loginPanelRef : registerPanelRef;
      const nextHeight = Math.ceil(activeRef.current?.getBoundingClientRect().height || 0);
      if (nextHeight > 0) {
        setPanelHeight(nextHeight);
      }
    };

    const raf = requestAnimationFrame(updatePanelHeight);
    const timeout = setTimeout(updatePanelHeight, 120);
    window.addEventListener("resize", updatePanelHeight);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      window.removeEventListener("resize", updatePanelHeight);
    };
  }, [activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const startedAt = Date.now();
    setLoading(true);
    setError("");

    try {
      await base44.auth.login(loginData);
      await checkAppState();
      navigate("/");
    } catch (err) {
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("2fa")) {
        try {
          window.sessionStorage.setItem(
            LOGIN_2FA_PENDING_KEY,
            JSON.stringify({
              email: String(loginData.email || "").trim(),
              password: String(loginData.password || ""),
              created_at: Date.now(),
            })
          );
        } catch {
          // ignore sessionStorage errors
        }
        navigate("/login-2fa");
        return;
      }
      setError(message || "Falha no login");
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await wait(MIN_LOADING_MS - elapsed);
      }
      setLoadingProgress(100);
      await wait(120);
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const startedAt = Date.now();
    setLoading(true);
    setError("");

    try {
      if (!String(registerData.full_name || "").trim()) {
        throw new Error("Nome é obrigatório");
      }
      if (!String(registerData.phone || "").trim()) {
        throw new Error("Telefone é obrigatório");
      }
      if (registerData.password !== registerData.confirmPassword) {
        throw new Error("As senhas não conferem");
      }

      await base44.auth.register({
        email: registerData.email,
        password: registerData.password,
        full_name: registerData.full_name,
        nick: registerData.nick,
        phone: registerData.phone,
      });
      await syncAutoCreatorEngagementForCurrentUser();
      await checkAppState();
      navigate("/");
    } catch (err) {
      setError(err?.message || "Falha no cadastro");
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await wait(MIN_LOADING_MS - elapsed);
      }
      setLoadingProgress(100);
      await wait(120);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = String(loginData.email || "").trim();
    if (!email) {
      setError("Informe seu email para recuperar a senha.");
      return;
    }

    try {
      setForgotLoading(true);
      setError("");
      setForgotInfo("");
      await base44.auth.forgotPassword(email);
      setForgotInfo("Se o email existir, enviaremos as instruções de recuperação.");
    } catch (err) {
      setError(err?.message || "Não foi possível iniciar a recuperação agora.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-slate-950 text-slate-100">
      <PWAInstallPrompt blocking />
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-cyan-300/25 bg-slate-900/85 p-6">
            <p className="mb-3 text-center text-lg font-semibold text-white">Carregando...</p>
            <div className="h-3 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-cyan-400 transition-[width] duration-150 ease-linear"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="mt-2 text-right text-sm text-cyan-200">{loadingProgress}%</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url(${profileCoverTile})`,
            backgroundSize: "420px",
            backgroundRepeat: "repeat",
          }}
        />
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-blue-700/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 p-4 md:grid-cols-2 md:p-8">
        <section className="hidden md:block">
          <div className="max-w-lg space-y-6">
            <div className="relative w-fit overflow-visible rounded-3xl border border-cyan-300/30 bg-slate-900/60 p-2 shadow-xl shadow-cyan-950/40">
              <img
                src={caricaturaSouza}
                alt="Caricatura do Souza"
                className="h-36 w-36 rounded-2xl object-cover"
              />
              <video
                className="pointer-events-none absolute left-1/2 z-20 h-20 w-auto -translate-x-1/2 drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
                style={{ top: "-34px" }}
                src={souzaTitleAnimado}
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
            <p className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
              Comunidade do Souza
            </p>
            <h1 className="text-4xl font-black leading-tight text-white lg:text-5xl">
              Entre na comunidade e acompanhe os sorteios ao vivo.
            </h1>
            <p className="text-base leading-relaxed text-slate-300">
              Acesse sua conta para participar das dinamicas, acompanhar resultados e receber avisos em tempo real.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-cyan-100">Acesso rapido</p>
                <p className="mt-1 text-slate-300">Entrar e participar em segundos.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-emerald-100">Ambiente seguro</p>
                <p className="mt-1 text-slate-300">Sessao protegida e autenticada.</p>
              </div>
            </div>
          </div>
        </section>

        <Card className="w-full border border-white/15 bg-slate-900/75 p-6 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl sm:p-7">
          <div className="mb-4 flex justify-center md:hidden">
            <div className="relative">
              <img
                src={caricaturaSouza}
                alt="Caricatura do Souza"
                className="h-24 w-24 rounded-2xl border border-cyan-300/30 bg-slate-800/70 object-cover shadow-lg shadow-cyan-900/30"
              />
              <video
                className="pointer-events-none absolute left-1/2 z-20 h-14 w-auto -translate-x-1/2 drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
                style={{ top: "-26px" }}
                src={souzaTitleAnimado}
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
          </div>
          <div className="mb-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              Bem-vindo
            </p>
            <h2 className="text-2xl font-black text-white">
              {activeTab === "login" ? "Acessar conta" : "Criar nova conta"}
            </h2>
            <p className="text-sm text-slate-300">
              {activeTab === "login"
                ? "Use seus dados para continuar."
                : "Preencha seus dados para comecar."}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-5 grid w-full grid-cols-2 rounded-xl border border-white/10 bg-slate-800/70 p-1">
              <TabsTrigger
                value="login"
                className="rounded-lg transition-all duration-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="rounded-lg transition-all duration-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950"
              >
                Cadastro
              </TabsTrigger>
            </TabsList>

            <div
              className="relative overflow-hidden transition-[height] duration-500 ease-out"
              style={{ height: panelHeight > 0 ? `${panelHeight}px` : "auto" }}
            >
              <div
                className={`flex w-[200%] transition-transform duration-500 ${
                  activeTab === "login" ? "translate-x-0" : "-translate-x-1/2"
                } items-start`}
                style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              >
                <div ref={loginPanelRef} className="w-1/2 pr-1">
                  <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Email</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="você@email.com"
                    required
                    className="h-11 border-slate-600 bg-slate-800/70 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showLoginPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={loginData.password}
                      onChange={(e) => setLoginData((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Sua senha"
                      required
                      className="h-11 border-slate-600 bg-slate-800/70 pr-11 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                      aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={forgotLoading || loading || activeTab !== "login"}
                    className="text-xs font-medium text-cyan-200 underline-offset-2 hover:text-cyan-100 hover:underline disabled:opacity-60"
                  >
                    {forgotLoading ? "Enviando..." : "Esqueci minha senha"}
                  </button>
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
                  disabled={loading || activeTab !== "login"}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                  </form>
                </div>

                <div ref={registerPanelRef} className="w-1/2 pl-1">
                  <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Nome</Label>
                  <Input
                    value={registerData.full_name}
                    onChange={(e) => setRegisterData((prev) => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Seu nome completo"
                    required
                    className="h-11 border-slate-600 bg-slate-800/70 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Nick</Label>
                  <Input
                    value={registerData.nick}
                    onChange={(e) => setRegisterData((prev) => ({ ...prev, nick: e.target.value }))}
                    placeholder="Como quer ser chamado"
                    className="h-11 border-slate-600 bg-slate-800/70 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Email</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={registerData.email}
                    onChange={(e) => setRegisterData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="você@email.com"
                    required
                    className="h-11 border-slate-600 bg-slate-800/70 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Telefone</Label>
                  <Input
                    type="tel"
                    value={registerData.phone}
                    onChange={(e) =>
                      setRegisterData((prev) => ({ ...prev, phone: formatPhone(e.target.value) }))
                    }
                    placeholder="(11) 99999-9999"
                    required
                    maxLength={15}
                    className="h-11 border-slate-600 bg-slate-800/70 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showRegisterPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Crie uma senha"
                      required
                      className="h-11 border-slate-600 bg-slate-800/70 pr-11 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                      aria-label={showRegisterPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-200">Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Repita a senha"
                      required
                      className="h-11 border-slate-600 bg-slate-800/70 pr-11 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                      aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
                  disabled={loading || activeTab !== "register"}
                >
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
                  </form>
                </div>
              </div>
            </div>
          </Tabs>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-slate-500/70 to-transparent" />

          {GOOGLE_CLIENT_ID ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white px-2 py-2 shadow-inner shadow-slate-950/5">
              <div ref={googleButtonRef} className="mx-auto w-full max-w-[320px] overflow-hidden" />
            </div>
          ) : (
            <p className="mb-2 text-xs text-amber-300">
               Defina `VITE_GOOGLE_CLIENT_ID` para habilitar login com Google.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
          {forgotInfo && (
            <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {forgotInfo}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}









