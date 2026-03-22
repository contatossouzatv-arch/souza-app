import React from "react";
import { FileText } from "lucide-react";
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
          <h1 className="text-3xl font-black text-white">Termos de Uso – SouzaTV</h1>
          <p className="mt-2 text-sm text-slate-300">Última atualização: {UPDATED_AT}</p>
        </header>

        <Section title="1. Aceitação dos Termos">
          <p>
            Ao acessar ou utilizar o aplicativo SouzaTV, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso.
          </p>
          <p>Caso não concorde com qualquer parte, não utilize o aplicativo.</p>
        </Section>

        <Section title="2. Natureza do Aplicativo">
          <p>O SouzaTV é um aplicativo digital de:</p>
          <BulletList
            items={[
              "entretenimento",
              "interação social",
              "participação em campanhas promocionais",
              "acesso a conteúdos e funcionalidades gamificadas",
            ]}
          />
          <p>O aplicativo pode conter:</p>
          <BulletList
            items={[
              "conteúdos interativos",
              "rankings e sistemas de pontuação",
              "campanhas promocionais",
              "links e integrações com serviços de terceiros",
            ]}
          />
        </Section>

        <Section title="3. Publicidade e Conteúdo Patrocinado">
          <p>O SouzaTV pode exibir conteúdos publicitários, promocionais ou patrocinados, incluindo:</p>
          <BulletList
            items={[
              "anúncios",
              "campanhas de divulgação",
              "conteúdos de parceiros",
              "links para serviços e plataformas de terceiros",
            ]}
          />
          <p>O aplicativo pode ser remunerado por meio de:</p>
          <BulletList
            items={[
              "publicidade exibida",
              "parcerias comerciais",
              "campanhas patrocinadas",
            ]}
          />
          <p className="font-semibold text-amber-200">Importante:</p>
          <BulletList
            items={[
              "O SouzaTV NÃO opera jogos ou apostas",
              "O SouzaTV NÃO garante resultados, ganhos ou retornos financeiros",
              "Qualquer interação do usuário com serviços de terceiros é de sua exclusiva responsabilidade",
              "O SouzaTV não possui controle sobre práticas, resultados ou políticas de plataformas externas",
            ]}
          />
        </Section>

        <Section title="4. Aviso de Risco (Jogos e Apostas)">
          <p>O usuário reconhece que:</p>
          <BulletList
            items={[
              "jogos e apostas envolvem riscos financeiros",
              "não existe garantia de lucro",
              "perdas podem ocorrer a qualquer momento",
              "resultados passados não garantem resultados futuros",
            ]}
          />
          <p>O uso é restrito a maiores de 18 anos.</p>
          <p>O SouzaTV recomenda:</p>
          <BulletList
            items={[
              "jogar com responsabilidade",
              "não utilizar valores essenciais",
              "buscar ajuda em caso de comportamento compulsivo",
            ]}
          />
        </Section>

        <Section title="5. Premiações, Pontuação e Sorteios">
          <p>O aplicativo pode oferecer:</p>
          <BulletList
            items={[
              "sistemas de pontuação",
              "rankings",
              "recompensas",
              "sorteios e premiações",
            ]}
          />

          <div className="space-y-3 pt-1">
            <div>
              <p className="font-semibold text-cyan-100">Natureza dos resultados</p>
              <BulletList
                items={[
                  "Resultados podem ser baseados em regras internas e/ou processos aleatórios",
                  "Não há garantia de ganho, premiação ou benefício",
                  "Participar não assegura qualquer tipo de vitória",
                ]}
              />
            </div>

            <div>
              <p className="font-semibold text-cyan-100">Aleatoriedade</p>
              <BulletList
                items={[
                  "Sorteios utilizam critérios aleatórios e/ou probabilísticos",
                  "O usuário reconhece que pode nunca ser premiado, mesmo participando continuamente",
                ]}
              />
            </div>

            <div>
              <p className="font-semibold text-cyan-100">Volume de participantes</p>
              <BulletList
                items={[
                  "A existência de múltiplos usuários reduz as chances individuais",
                  "O tempo para eventual premiação é indeterminado",
                ]}
              />
            </div>

            <div>
              <p className="font-semibold text-cyan-100">Pontuação e ranking</p>
              <BulletList
                items={[
                  "Pontos podem variar conforme regras do aplicativo",
                  "Pontuação pode ser alterada, recalculada ou atualizada a qualquer momento",
                  "Ranking não garante premiação",
                ]}
              />
            </div>

            <div>
              <p className="font-semibold text-cyan-100">Regras e elegibilidade</p>
              <BulletList
                items={[
                  "Cada campanha pode possuir regras específicas",
                  "O usuário concorda com tais regras ao participar",
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title="6. Uso Indevido e Fraudes">
          <p>É proibido:</p>
          <BulletList
            items={[
              "criar múltiplas contas para obter vantagem",
              "utilizar bots, scripts ou automações",
              "manipular rankings ou sistemas",
              "explorar falhas do sistema",
            ]}
          />
          <p>O SouzaTV pode:</p>
          <BulletList
            items={[
              "suspender contas",
              "remover benefícios",
              "cancelar premiações suspeitas",
            ]}
          />
        </Section>

        <Section title="7. Responsabilidade do Usuário">
          <p>O usuário é responsável por:</p>
          <BulletList
            items={[
              "suas decisões financeiras",
              "uso do aplicativo",
              "veracidade das informações fornecidas",
            ]}
          />
          <p>O SouzaTV não se responsabiliza por:</p>
          <BulletList
            items={[
              "perdas financeiras",
              "expectativas de ganho não atendidas",
              "frustrações relacionadas a resultados",
            ]}
          />
        </Section>

        <Section title="8. Conta do Usuário">
          <p>Ao criar uma conta, você concorda em:</p>
          <BulletList
            items={[
              "fornecer informações verdadeiras",
              "manter dados atualizados",
              "proteger suas credenciais",
            ]}
          />
          <p>A conta pode ser suspensa em caso de:</p>
          <BulletList
            items={[
              "fraude",
              "abuso",
              "violação destes termos",
            ]}
          />
        </Section>

        <Section title="9. Limitação de Responsabilidade">
          <p>O SouzaTV não garante:</p>
          <BulletList
            items={[
              "funcionamento contínuo",
              "ausência de erros",
              "disponibilidade ininterrupta",
            ]}
          />
          <p>A responsabilidade do aplicativo é limitada ao máximo permitido por lei.</p>
        </Section>

        <Section title="10. Modificações">
          <p>Estes termos podem ser atualizados a qualquer momento.</p>
          <p>O uso contínuo do aplicativo implica aceitação das alterações.</p>
        </Section>

        <Section title="11. Contato">
          <p>
            Email:{" "}
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
