import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

function isStrongEnough(password) {
  const value = String(password || "");
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setError("Link inválido ou incompleto.");
      return;
    }
    if (!isStrongEnough(newPassword)) {
      setError("Use ao menos 8 caracteres com letras e números.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação da senha não confere.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await base44.auth.resetPassword(token, newPassword);
      setSuccess("Senha redefinida com sucesso. Você já pode entrar no app.");
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err?.message || "Não foi possível redefinir sua senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_34%),linear-gradient(180deg,#020617_0%,#071120_40%,#020617_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <Card className="w-full border-white/10 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-200">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Redefinir senha</h1>
              <p className="text-sm text-slate-300">Crie uma nova senha para acessar o SouzaTV.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Nova senha</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border-slate-700 bg-slate-900 text-white"
                placeholder="Digite sua nova senha"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Confirmar nova senha</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-slate-700 bg-slate-900 text-white"
                placeholder="Repita a nova senha"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{success}</span>
                </div>
              </div>
            ) : null}

            <Button type="submit" disabled={loading || !token} className="h-11 w-full bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Lembrou sua senha?{" "}
            <Link to="/login" className="text-cyan-300 underline underline-offset-2">
              Voltar para o login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
