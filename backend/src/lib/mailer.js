import { env } from "../config/env.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  const appName = "SouzaTV";
  const safeLink = String(resetLink || "").trim();
  const subject = "Redefina sua senha no SouzaTV";
  const text = [
    `Você solicitou a redefinição de senha do ${appName}.`,
    "",
    "Use o link abaixo para criar uma nova senha:",
    safeLink,
    "",
    `Esse link expira em ${env.resetTokenTtlMin} minuto(s).`,
    "Se você não pediu essa alteração, ignore este e-mail.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;background:#020617;padding:32px;color:#e2e8f0">
      <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.18);border-radius:20px;padding:32px">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9">SouzaTV</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#fff">Redefina sua senha</h1>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#cbd5e1">
          Você solicitou a redefinição de senha do ${appName}. Clique no botão abaixo para criar uma nova senha.
        </p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(safeLink)}" style="display:inline-block;background:#22d3ee;color:#082f49;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:14px">
            Redefinir senha
          </a>
        </p>
        <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#cbd5e1">
          Se preferir, copie e cole este link no navegador:
        </p>
        <p style="margin:0 0 18px;font-size:12px;line-height:1.7;color:#67e8f9;word-break:break-all">${escapeHtml(safeLink)}</p>
        <p style="margin:0;font-size:12px;line-height:1.7;color:#94a3b8">
          Esse link expira em ${env.resetTokenTtlMin} minuto(s). Se você não pediu essa alteração, ignore este e-mail.
        </p>
      </div>
    </div>
  `;

  if (env.mailMode === "console") {
    console.log("[MAIL:console] Password reset link:", safeLink);
    return { ok: true, mode: "console" };
  }

  if (env.mailMode !== "resend") {
    throw new Error(`MAIL_MODE inválido para envio de reset: ${env.mailMode}`);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.resendFromName
        ? `${env.resendFromName} <${env.resendFromEmail}>`
        : env.resendFromEmail,
      to: [String(to || "").trim()],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar email pelo Resend (${response.status}): ${details || "sem detalhes"}`);
  }

  return response.json().catch(() => ({ ok: true, mode: "resend" }));
}
