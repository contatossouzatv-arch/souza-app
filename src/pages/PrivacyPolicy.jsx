import React from "react";
import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const UPDATED_AT = "22 de março de 2026";

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-5">
      <h2 className="mb-3 text-lg font-bold text-cyan-200">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">{children}</div>
    </section>
  );
}

function BulletList({ items }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
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
          <h1 className="text-3xl font-black text-white">Política de Privacidade – SouzaTV</h1>
          <p className="mt-2 text-sm text-slate-300">Última atualização: {UPDATED_AT}</p>
          <p className="mt-4 text-sm leading-relaxed text-slate-200">
            Esta Política de Privacidade descreve como o aplicativo SouzaTV coleta, utiliza, armazena e protege os dados dos usuários.
          </p>
        </header>

        <Section title="1. Dados Coletados">
          <p>Podemos coletar as seguintes informações:</p>
          <BulletList
            items={[
              "Nome ou apelido",
              "E-mail",
              "Telefone (quando informado)",
              "Dados de autenticação (incluindo login via Google)",
              "Endereço IP",
              "Informações de dispositivo e navegador",
              "Interações dentro do aplicativo",
              "Dados relacionados a pontuação, ranking e participação em campanhas",
            ]}
          />
        </Section>

        <Section title="2. Finalidade do Uso dos Dados">
          <p>Os dados são utilizados para:</p>
          <BulletList
            items={[
              "identificação e autenticação do usuário",
              "funcionamento do sistema de pontuação e ranking",
              "participação em campanhas, sorteios e premiações",
              "comunicação com o usuário",
              "prevenção de fraudes e uso indevido",
              "melhoria da experiência dentro do aplicativo",
            ]}
          />
        </Section>

        <Section title="3. Login com Google">
          <p>Ao utilizar login com Google:</p>
          <BulletList
            items={[
              "coletamos apenas os dados autorizados pelo usuário",
              "não temos acesso à sua senha",
              "respeitamos as políticas de privacidade do Google",
            ]}
          />
        </Section>

        <Section title="4. Compartilhamento de Dados">
          <p>O SouzaTV não vende dados pessoais.</p>
          <p>Os dados podem ser compartilhados apenas quando necessário:</p>
          <BulletList
            items={[
              "com provedores de infraestrutura (hospedagem, banco de dados)",
              "com serviços essenciais para funcionamento do aplicativo",
              "quando exigido por lei",
              "para proteção jurídica ou prevenção de fraudes",
            ]}
          />
        </Section>

        <Section title="5. Cookies e Tecnologias">
          <p>O aplicativo pode utilizar:</p>
          <BulletList
            items={[
              "cookies",
              "armazenamento local",
              "tecnologias de análise",
            ]}
          />
          <p>Para:</p>
          <BulletList
            items={[
              "melhorar desempenho",
              "analisar comportamento de uso",
              "garantir segurança",
            ]}
          />
        </Section>

        <Section title="6. Segurança">
          <p>Adotamos medidas técnicas e organizacionais para proteger os dados dos usuários.</p>
          <p>
            No entanto, nenhum sistema é completamente seguro, e não podemos garantir proteção absoluta contra acessos não autorizados.
          </p>
        </Section>

        <Section title="7. Direitos do Usuário (LGPD)">
          <p>O usuário pode, a qualquer momento:</p>
          <BulletList
            items={[
              "solicitar acesso aos seus dados",
              "corrigir informações incorretas",
              "solicitar exclusão da conta",
              "revogar consentimento",
            ]}
          />
          <p>Solicitações devem ser feitas pelo e-mail:</p>
          <p>
            <a
              href="mailto:contato.ssouzatv@gmail.com"
              className="text-cyan-300 underline underline-offset-2"
            >
              contato.ssouzatv@gmail.com
            </a>
          </p>
        </Section>

        <Section title="8. Plataformas de Terceiros">
          <p>O aplicativo pode conter links para serviços externos.</p>
          <p>O SouzaTV não se responsabiliza pelas práticas de privacidade dessas plataformas.</p>
        </Section>

        <Section title="9. Retenção de Dados">
          <p>Os dados serão mantidos apenas pelo tempo necessário para:</p>
          <BulletList
            items={[
              "cumprimento das finalidades descritas",
              "obrigações legais",
              "segurança do aplicativo",
            ]}
          />
        </Section>

        <Section title="10. Alterações desta Política">
          <p>Esta Política de Privacidade pode ser atualizada a qualquer momento.</p>
          <p>O uso contínuo do aplicativo implica aceitação das alterações.</p>
        </Section>

        <Section title="11. Contato">
          <p>Para dúvidas ou solicitações:</p>
          <p>
            <a
              href="mailto:contato.ssouzatv@gmail.com"
              className="text-cyan-300 underline underline-offset-2"
            >
              contato.ssouzatv@gmail.com
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
}
