export const PROFILE_ENGAGEMENT_GUIDE_SETTINGS_KEY = "profile_engagement_guide_rules_v1";

export const DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG = {
  enabled: true,
  link_label: "Como ser um deles!",
  modal_title: "Como ser um deles!",
  modal_subtitle: "Regras do ranking Mais Engajados",
  highlight_text: "Ranking vitalicio: consistencia de uso + aceleracao por deposito.",
  instructions:
    "1) O ranking considera historico total, nao ciclo semanal.\n2) Quanto mais dias ativos e participacoes, maior a base de pontuacao.\n3) Depositos maiores aceleram a subida de nivel.\n4) Novos usuarios recebem impulso inicial para competir mais rapido.",
  rules: [
    {
      id: "daily-activity",
      title: "Atividade diaria",
      description: "Entrar no app e manter frequencia de uso durante a semana.",
    },
    {
      id: "social-strength",
      title: "Forca social",
      description: "Receber novas curtidas e seguidores de forma consistente.",
    },
    {
      id: "competitive-presence",
      title: "Presenca competitiva",
      description: "Participar das dinamicas competitivas e manter pontuacao ativa.",
    },
    {
      id: "profile-quality",
      title: "Perfil atrativo",
      description: "Ter perfil completo aumenta cliques e conversao de visitantes.",
    },
  ],
  ranking_weights: {
    points_per_active_day: 6,
    points_per_activity: 3,
    points_per_brl_deposit: 0.2,
    newcomer_boost_days: 21,
    newcomer_multiplier: 1.25,
  },
};

function toNonEmptyString(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function normalizeEngagementGuideConfig(raw = {}) {
  const safeRules = Array.isArray(raw?.rules)
    ? raw.rules
        .map((item, index) => {
          const title = toNonEmptyString(item?.title);
          const description = toNonEmptyString(item?.description);
          if (!title && !description) return null;
          return {
            id: toNonEmptyString(item?.id, `engagement-rule-${index + 1}`),
            title: title || `Regra ${index + 1}`,
            description,
          };
        })
        .filter(Boolean)
    : [];

  return {
    enabled: raw?.enabled !== false,
    link_label: toNonEmptyString(raw?.link_label, DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.link_label),
    modal_title: toNonEmptyString(raw?.modal_title, DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.modal_title),
    modal_subtitle: toNonEmptyString(raw?.modal_subtitle, DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.modal_subtitle),
    highlight_text: toNonEmptyString(raw?.highlight_text, DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.highlight_text),
    instructions: toNonEmptyString(raw?.instructions, DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.instructions),
    rules: safeRules.length > 0 ? safeRules : DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.rules,
    ranking_weights: {
      points_per_active_day: Math.max(
        0,
        Number(raw?.ranking_weights?.points_per_active_day ?? DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.ranking_weights.points_per_active_day)
      ),
      points_per_activity: Math.max(
        0,
        Number(raw?.ranking_weights?.points_per_activity ?? DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.ranking_weights.points_per_activity)
      ),
      points_per_brl_deposit: Math.max(
        0,
        Number(raw?.ranking_weights?.points_per_brl_deposit ?? DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.ranking_weights.points_per_brl_deposit)
      ),
      newcomer_boost_days: Math.max(
        0,
        Math.round(
          Number(raw?.ranking_weights?.newcomer_boost_days ?? DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.ranking_weights.newcomer_boost_days)
        )
      ),
      newcomer_multiplier: Math.max(
        1,
        Number(raw?.ranking_weights?.newcomer_multiplier ?? DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG.ranking_weights.newcomer_multiplier)
      ),
    },
  };
}
