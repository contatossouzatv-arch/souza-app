const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PROFILE_COMPETITION_SETTINGS_KEY = "profile_competition_rules_v1";

export const DEFAULT_PROFILE_COMPETITION_CONFIG = {
  enabled: true,
  title: "Liga Competitiva",
  subtitle: "Acumule pontos no ciclo, suba no ranking e garanta sua banca.",
  preview_mode: "real",
  cycle_days: 7,
  cycle_anchor_date: "2026-01-01T00:00:00.000Z",
  winners_count: 10,
  reward_amount: 20,
  reward_currency: "BRL",
  top3_frame_url: "",
  finished_title: "Ciclo encerrado",
  finished_subtitle: "Aguardando processamento do resultado e abertura do novo ciclo.",
  finished_cta_label: "Novo ciclo em breve",
  instructions:
    "1) Some pontos concluindo tarefas ativas.\n2) O ranking considera apenas o ciclo atual.\n3) Ao final do contador, o ciclo fecha e reinicia.\n4) Top 10 recebe banca de R$20.",
  tasks: [
    { id: "approved_deposit_count", label: "Deposito aprovado", enabled: true, points: 8, step_value: 1 },
    { id: "approved_deposit_amount_step", label: "Volume de depositos (a cada R$10)", enabled: true, points: 1, step_value: 10 },
    { id: "live_participation", label: "Participacao em live", enabled: true, points: 12, step_value: 1 },
    { id: "game_call_participation", label: "Participacao no call jogo", enabled: true, points: 8, step_value: 1 },
    { id: "instant_raffle_participation", label: "Participacao em sorteio rapido", enabled: true, points: 8, step_value: 1 },
    { id: "validated_win", label: "Premio validado", enabled: true, points: 50, step_value: 1 },
  ],
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveInt(value, fallback = 1) {
  return Math.max(1, Math.round(toNumber(value, fallback)));
}

function toNonNegativeInt(value, fallback = 0) {
  return Math.max(0, Math.round(toNumber(value, fallback)));
}

function parseDate(value, fallbackIso) {
  const parsed = new Date(value || fallbackIso);
  if (Number.isNaN(parsed.getTime())) return new Date(fallbackIso);
  return parsed;
}

export function normalizeCompetitionConfig(raw = {}) {
  const defaultsById = Object.fromEntries(
    DEFAULT_PROFILE_COMPETITION_CONFIG.tasks.map((item) => [item.id, item])
  );
  const incomingTasks = Array.isArray(raw.tasks) ? raw.tasks : DEFAULT_PROFILE_COMPETITION_CONFIG.tasks;
  const normalizedTasks = incomingTasks
    .map((task) => {
      const id = String(task?.id || "").trim();
      if (!id) return null;
      const fallback = defaultsById[id] || { id, label: id, points: 1, enabled: true, step_value: 1 };
      return {
        id,
        label: String(task?.label || fallback.label || id).trim() || id,
        enabled: Boolean(task?.enabled),
        points: toNonNegativeInt(task?.points, fallback.points),
        step_value: toPositiveInt(task?.step_value, fallback.step_value || 1),
      };
    })
    .filter(Boolean);

  return {
    enabled: raw?.enabled !== false,
    title: String(raw?.title || DEFAULT_PROFILE_COMPETITION_CONFIG.title).trim() || DEFAULT_PROFILE_COMPETITION_CONFIG.title,
    subtitle:
      String(raw?.subtitle || DEFAULT_PROFILE_COMPETITION_CONFIG.subtitle).trim() ||
      DEFAULT_PROFILE_COMPETITION_CONFIG.subtitle,
    preview_mode: (() => {
      const mode = String(raw?.preview_mode || DEFAULT_PROFILE_COMPETITION_CONFIG.preview_mode).toLowerCase();
      if (mode === "finished") return "finished";
      if (mode === "live") return "live";
      return "real";
    })(),
    cycle_days: toPositiveInt(raw?.cycle_days, DEFAULT_PROFILE_COMPETITION_CONFIG.cycle_days),
    cycle_anchor_date: parseDate(raw?.cycle_anchor_date, DEFAULT_PROFILE_COMPETITION_CONFIG.cycle_anchor_date).toISOString(),
    winners_count: toPositiveInt(raw?.winners_count, DEFAULT_PROFILE_COMPETITION_CONFIG.winners_count),
    reward_amount: Math.max(0, toNumber(raw?.reward_amount, DEFAULT_PROFILE_COMPETITION_CONFIG.reward_amount)),
    reward_currency:
      String(raw?.reward_currency || DEFAULT_PROFILE_COMPETITION_CONFIG.reward_currency).trim() ||
      DEFAULT_PROFILE_COMPETITION_CONFIG.reward_currency,
    top3_frame_url: String(raw?.top3_frame_url || "").trim(),
    finished_title:
      String(raw?.finished_title || DEFAULT_PROFILE_COMPETITION_CONFIG.finished_title).trim() ||
      DEFAULT_PROFILE_COMPETITION_CONFIG.finished_title,
    finished_subtitle:
      String(raw?.finished_subtitle || DEFAULT_PROFILE_COMPETITION_CONFIG.finished_subtitle).trim() ||
      DEFAULT_PROFILE_COMPETITION_CONFIG.finished_subtitle,
    finished_cta_label:
      String(raw?.finished_cta_label || DEFAULT_PROFILE_COMPETITION_CONFIG.finished_cta_label).trim() ||
      DEFAULT_PROFILE_COMPETITION_CONFIG.finished_cta_label,
    instructions:
      String(raw?.instructions || DEFAULT_PROFILE_COMPETITION_CONFIG.instructions).trim() ||
      DEFAULT_PROFILE_COMPETITION_CONFIG.instructions,
    tasks: normalizedTasks.length > 0 ? normalizedTasks : DEFAULT_PROFILE_COMPETITION_CONFIG.tasks,
  };
}

function eventDate(value) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isInRange(date, start, end) {
  if (!date) return false;
  const ts = date.getTime();
  return ts >= start.getTime() && ts < end.getTime();
}

function getCycleWindow(now, anchorDate, cycleDays) {
  const anchor = parseDate(anchorDate, DEFAULT_PROFILE_COMPETITION_CONFIG.cycle_anchor_date);
  const cycleMs = toPositiveInt(cycleDays, 7) * MS_PER_DAY;
  let startMs = anchor.getTime();
  const nowMs = now.getTime();

  if (nowMs >= startMs) {
    const cyclesElapsed = Math.floor((nowMs - startMs) / cycleMs);
    startMs += cyclesElapsed * cycleMs;
  } else {
    const cyclesBack = Math.ceil((startMs - nowMs) / cycleMs);
    startMs -= cyclesBack * cycleMs;
  }

  const start = new Date(startMs);
  const end = new Date(startMs + cycleMs);
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(0, nowMs - start.getTime());
  const remainingMs = Math.max(0, end.getTime() - nowMs);
  const progressPct = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;

  return { start, end, totalMs, elapsedMs, remainingMs, progressPct };
}

function addPointsByCount(state, userId, key, count, task) {
  const safeCount = Math.max(0, Number(count || 0));
  if (!task?.enabled || safeCount <= 0) return;
  const steps = Math.floor(safeCount / Math.max(1, Number(task.step_value || 1)));
  if (steps <= 0) return;
  const points = steps * Math.max(0, Number(task.points || 0));
  if (!state[userId]) return;
  state[userId].points += points;
  state[userId].breakdown[key] = (state[userId].breakdown[key] || 0) + points;
}

export function buildCompetitionLeaderboard({
  users = [],
  deposits = [],
  liveParticipations = [],
  gameParticipations = [],
  instantParticipations = [],
  winnerAudits = [],
  bonusEvents = [],
  config,
  now = new Date(),
}) {
  const safeConfig = normalizeCompetitionConfig(config);
  const cycle = getCycleWindow(now, safeConfig.cycle_anchor_date, safeConfig.cycle_days);
  const tasksMap = Object.fromEntries(safeConfig.tasks.map((task) => [task.id, task]));

  const userState = {};
  users.forEach((user) => {
    if (!user?.id) return;
    userState[user.id] = {
      user_id: user.id,
      nick: String(user.nick || user.full_name || "Usuario"),
      avatar_emoji: String(user.avatar_emoji || ""),
      profile_avatar_id: String(user.profile_avatar_id || ""),
      profile_image_mode: String(user.profile_image_mode || "avatar"),
      profile_image_status: String(user.profile_image_status || "none"),
      profile_image_url: String(user.profile_image_url || ""),
      points: 0,
      breakdown: {},
      stats: {
        approvedDeposits: 0,
        approvedAmount: 0,
        liveParticipations: 0,
        gameParticipations: 0,
        instantParticipations: 0,
        validatedWins: 0,
      },
    };
  });

  const depositCountByUser = {};
  const depositAmountByUser = {};
  deposits.forEach((item) => {
    if (!item?.user_id || item.status !== "approved") return;
    const createdAt = eventDate(item.approved_date || item.updated_date || item.created_date);
    if (!isInRange(createdAt, cycle.start, cycle.end)) return;
    depositCountByUser[item.user_id] = (depositCountByUser[item.user_id] || 0) + 1;
    depositAmountByUser[item.user_id] = (depositAmountByUser[item.user_id] || 0) + Math.max(0, toNumber(item.amount, 0));
  });

  const liveCountByUser = {};
  liveParticipations.forEach((item) => {
    if (!item?.user_id) return;
    const createdAt = eventDate(item.created_date || item.updated_date);
    if (!isInRange(createdAt, cycle.start, cycle.end)) return;
    liveCountByUser[item.user_id] = (liveCountByUser[item.user_id] || 0) + 1;
  });

  const gameCountByUser = {};
  gameParticipations.forEach((item) => {
    if (!item?.user_id) return;
    const createdAt = eventDate(item.created_date || item.updated_date);
    if (!isInRange(createdAt, cycle.start, cycle.end)) return;
    gameCountByUser[item.user_id] = (gameCountByUser[item.user_id] || 0) + 1;
  });

  const instantCountByUser = {};
  instantParticipations.forEach((item) => {
    if (!item?.user_id) return;
    const createdAt = eventDate(item.created_date || item.updated_date);
    if (!isInRange(createdAt, cycle.start, cycle.end)) return;
    instantCountByUser[item.user_id] = (instantCountByUser[item.user_id] || 0) + 1;
  });

  const winsCountByUser = {};
  winnerAudits.forEach((item) => {
    if (!item?.user_id || item?.status !== "validated") return;
    const createdAt = eventDate(item.validated_date || item.updated_date || item.created_date);
    if (!isInRange(createdAt, cycle.start, cycle.end)) return;
    winsCountByUser[item.user_id] = (winsCountByUser[item.user_id] || 0) + 1;
  });

  const bonusPointsByUser = {};
  bonusEvents.forEach((item) => {
    if (!item?.user_id) return;
    const createdAt = eventDate(item.created_date || item.updated_date);
    if (!isInRange(createdAt, cycle.start, cycle.end)) return;
    bonusPointsByUser[item.user_id] = (bonusPointsByUser[item.user_id] || 0) + Math.max(0, toNumber(item.points, 0));
  });

  Object.values(userState).forEach((entry) => {
    const userId = entry.user_id;
    const approvedDeposits = depositCountByUser[userId] || 0;
    const approvedAmount = depositAmountByUser[userId] || 0;
    const liveCount = liveCountByUser[userId] || 0;
    const gameCount = gameCountByUser[userId] || 0;
    const instantCount = instantCountByUser[userId] || 0;
    const winsCount = winsCountByUser[userId] || 0;
    const bonusPoints = bonusPointsByUser[userId] || 0;

    entry.stats.approvedDeposits = approvedDeposits;
    entry.stats.approvedAmount = Math.round(approvedAmount * 100) / 100;
    entry.stats.liveParticipations = liveCount;
    entry.stats.gameParticipations = gameCount;
    entry.stats.instantParticipations = instantCount;
    entry.stats.validatedWins = winsCount;
    entry.stats.bonusPoints = bonusPoints;

    addPointsByCount(userState, userId, "approved_deposit_count", approvedDeposits, tasksMap.approved_deposit_count);
    addPointsByCount(
      userState,
      userId,
      "approved_deposit_amount_step",
      approvedAmount,
      tasksMap.approved_deposit_amount_step
    );
    addPointsByCount(userState, userId, "live_participation", liveCount, tasksMap.live_participation);
    addPointsByCount(userState, userId, "game_call_participation", gameCount, tasksMap.game_call_participation);
    addPointsByCount(
      userState,
      userId,
      "instant_raffle_participation",
      instantCount,
      tasksMap.instant_raffle_participation
    );
    addPointsByCount(userState, userId, "validated_win", winsCount, tasksMap.validated_win);
    entry.points += bonusPoints;
    if (bonusPoints > 0) {
      entry.breakdown.manual_bonus_points = (entry.breakdown.manual_bonus_points || 0) + bonusPoints;
    }
  });

  const entries = Object.values(userState)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.stats.approvedAmount !== a.stats.approvedAmount) return b.stats.approvedAmount - a.stats.approvedAmount;
      return a.nick.localeCompare(b.nick);
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

  const rewardLabel = safeConfig.reward_amount > 0
    ? `Top ${safeConfig.winners_count} ganha banca de R$${safeConfig.reward_amount.toFixed(2)} no fim do ciclo.`
    : `Top ${safeConfig.winners_count} ganha premio no fim do ciclo.`;

  return {
    config: safeConfig,
    cycle,
    rewardLabel,
    totalPlayers: entries.length,
    entries,
  };
}

export function formatTimeLeft(ms = 0) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSec = Math.floor(safeMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${String(days).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}
