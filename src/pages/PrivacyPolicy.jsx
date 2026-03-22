import React from "react";
import { ShieldCheck } from "lucide-react";

import { useNavigate } from "react-router-dom";

const UPDATED_AT = "03/03/2026";

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
      <h2 className="mb-3 text-lg font-bold text-cyan-200">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-slate-300 transition hover:text-cyan-200"
        >
          ← Voltar
        </button>
        <header className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            <ShieldCheck className="h-4 w-4" />
            Documento Legal
          </div>
          <h1 className="text-3xl font-black text-white">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-slate-300">Última atualização: {UPDATED_AT}</p>
          <p className="mt-4 text-sm leading-relaxed text-slate-200">
            Esta política explica como coletamos, utilizamos e protegemos seus dados.
          </p>
        </header>

        <Section title="1. DADOS COLETADOS">
          <p>Podemos coletar:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nome ou apelido</li>
            <li>Telefone</li>
            <li>E-mail</li>
            <li>Dados de acesso</li>
            <li>IP e dispositivo</li>
            <li>Interações dentro do app</li>
          </ul>
        </Section>

        <Section title="2. FINALIDADE DOS DADOS">
          <p>Os dados são utilizados para:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Identificação de usuário</li>
            <li>Controle de pontuação</li>
            <li>Comunicação</li>
            <li>Prevenção de fraude</li>
            <li>Melhorar a experiência</li>
          </ul>
        </Section>

        <Section title="3. COMPARTILHAMENTO">
          <p>Não vendemos dados pessoais.</p>
          <p>Podemos compartilhar informações quando:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Exigido por lei</li>
            <li>Para proteção jurídica</li>
            <li>Para prevenir fraudes</li>
          </ul>
        </Section>

        <Section title="4. SEGURANÇA">
          <p>Adotamos medidas técnicas para proteger os dados, porém nenhum sistema é 100% invulnerável.</p>
        </Section>

        <Section title="5. DIREITOS DO USUÁRIO (LGPD)">
          <p>O usuário pode solicitar:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Acesso aos seus dados</li>
            <li>Correção de dados incorretos</li>
            <li>Exclusão da conta</li>
            <li>Revogação de consentimento</li>
          </ul>
          <p>
            Solicitações podem ser feitas via: <span className="font-semibold text-cyan-200">contato.ssouzatv@gmail.com</span>
          </p>
        </Section>

        <Section title="6. COOKIES">
          <p>O aplicativo pode utilizar cookies para:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Melhorar desempenho</li>
            <li>Analisar uso</li>
            <li>Segurança</li>
          </ul>
        </Section>

        <Section title="7. CONTATO">
          <p>Para dúvidas:</p>
          <p className="font-semibold text-cyan-200">contato.ssouzatv@gmail.com</p>
          <p className="font-semibold text-cyan-200">(41) 99712-9643</p>
        </Section>
      </div>
    </div>
  );
}
