import React from "react";
import { FileText } from "lucide-react";
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

export default function TermsOfUse() {
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
            <FileText className="h-4 w-4" />
            Documento Legal
          </div>
          <h1 className="text-3xl font-black text-white">Termos de Uso</h1>
          <p className="mt-2 text-sm text-slate-300">Última atualização: {UPDATED_AT}</p>
          <p className="mt-4 text-sm leading-relaxed text-slate-200">
            Ao acessar ou utilizar este aplicativo, você concorda com os presentes Termos de Uso. Caso não concorde, não utilize o aplicativo.
          </p>
        </header>

        <Section title="1. OBJETO">
          <p>Este aplicativo disponibiliza:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Sistema de participação com pontuação</li>
            <li>Interações, jogos promocionais e desafios</li>
            <li>Distribuição de recompensas promocionais</li>
            <li>Conteúdo informativo relacionado a jogos online</li>
          </ul>
          <p>O aplicativo possui caráter informativo e promocional, não configurando recomendação financeira.</p>
        </Section>

        <Section title="2. MAIORIDADE">
          <p>O uso é permitido apenas para maiores de 18 anos.</p>
          <p>Ao utilizar o app, o usuário declara ser maior de 18 anos e estar plenamente capaz para atos civis.</p>
        </Section>

        <Section title="3. RISCOS ENVOLVIDOS">
          <ul className="list-disc space-y-1 pl-5">
            <li>Não há garantia de ganhos.</li>
            <li>Jogos e apostas envolvem risco financeiro.</li>
            <li>O usuário é integralmente responsável por suas decisões.</li>
            <li>O app não promete retorno financeiro.</li>
          </ul>
        </Section>

        <Section title="4. RESPONSABILIDADE DO USUÁRIO">
          <p>O usuário concorda em:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Utilizar o aplicativo de forma lícita</li>
            <li>Não fraudar sistemas de pontuação</li>
            <li>Não utilizar múltiplas contas</li>
            <li>Não manipular resultados</li>
            <li>Não prejudicar outros participantes</li>
          </ul>
          <p>O descumprimento pode resultar em bloqueio sem aviso prévio.</p>
        </Section>

        <Section title="5. RECOMPENSAS E PONTUAÇÃO">
          <ul className="list-disc space-y-1 pl-5">
            <li>Pontos não possuem valor monetário.</li>
            <li>Recompensas promocionais podem ser alteradas ou encerradas a qualquer momento.</li>
            <li>O aplicativo pode modificar regras sem aviso prévio.</li>
          </ul>
        </Section>

        <Section title="6. ISENÇÃO DE RESPONSABILIDADE">
          <p>O aplicativo:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Não é casa de apostas.</li>
            <li>Não realiza intermediação financeira.</li>
            <li>Não garante lucros.</li>
            <li>Não se responsabiliza por perdas financeiras externas.</li>
          </ul>
        </Section>

        <Section title="7. ALTERAÇÕES">
          <p>Estes termos podem ser alterados a qualquer momento. A continuidade do uso implica concordância.</p>
        </Section>

      </div>
    </div>
  );
}
