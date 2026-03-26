import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import profileCoverTile from "../../assets-para-app/profile-cover-tile.png";

const MIN_LOADING_MS = 2000;
const LOGIN_2FA_PENDING_KEY = "souza_login_2fa_pending_v1";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoginTwoFactor() {
  const navigate = useNavigate();
  const { checkAppState } = useAuth();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [pendingLogin, setPendingLogin] = useState(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(LOGIN_2FA_PENDING_KEY);
      if (!raw) {
        navigate("/login", { replace: true });
        return;
      }

      const parsed = JSON.parse(raw);
      const isPasswordFlow = parsed?.provider !== "google" && parsed?.email && parsed?.password;
      const isGoogleFlow =
        parsed?.provider === "google" &&
        (parsed?.challengeToken || parsed?.credential);

      if (!isPasswordFlow && !isGoogleFlow) {
        window.sessionStorage.removeItem(LOGIN_2FA_PENDING_KEY);
        navigate("/login", { replace: true });
        return;
      }

      setPendingLogin(parsed);
    } catch {
      window.sessionStorage.removeItem(LOGIN_2FA_PENDING_KEY);
      navigate("/login", { replace: true });
    }
  }, [navigate]);

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

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pendingLogin) return;
    const startedAt = Date.now();
    setLoading(true);
    setError("");

    try {
      const normalizedOtp = String(otp || "").replace(/\D/g, "").slice(0, 8);
      if (pendingLogin.provider === "google") {
        await base44.auth.loginWithGoogle(
          pendingLogin.credential || "",
          normalizedOtp,
          pendingLogin.challengeToken || ""
        );
      } else {
        await base44.auth.login({
          email: pendingLogin.email,
          password: pendingLogin.password,
          otp: normalizedOtp,
        });
      }

      window.sessionStorage.removeItem(LOGIN_2FA_PENDING_KEY);
      await checkAppState();
      navigate("/");
    } catch (err) {
      setError(err?.message || "Código inválido.");
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

  const handleBack = () => {
    window.sessionStorage.removeItem(LOGIN_2FA_PENDING_KEY);
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-slate-100">
      {loading ? (
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
      ) : null}

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
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center">
        <Card className="w-full border border-white/15 bg-slate-900/75 p-6 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl">
          <h1 className="text-center text-xl font-bold text-white">Verificação em 2 etapas</h1>
          <p className="mt-2 text-center text-sm text-slate-300">
            Digite o código do autenticador para concluir o login.
          </p>
          <p className="mt-1 text-center text-xs text-cyan-300">
            {pendingLogin?.provider === "google" ? "Login com Google" : pendingLogin?.email || ""}
          </p>

          <form onSubmit={handleVerify} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-slate-200">Código 2FA</Label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="000000"
                required
                className="h-11 border-slate-600 bg-slate-800/70 text-white placeholder:text-slate-400 focus-visible:ring-cyan-400"
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={loading} className="h-11 w-full bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400">
              Confirmar e entrar
            </Button>
            <Button type="button" variant="outline" onClick={handleBack} className="h-11 w-full border-slate-600 text-slate-200 hover:bg-slate-800">
              Voltar para login
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
