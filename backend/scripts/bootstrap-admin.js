import bcrypt from "bcryptjs";
import { env } from "../src/config/env.js";
import { ensureDb, findUserByEmail, findUserById, findOrCreateUserByEmail, pool, updateUserById } from "../src/db/index.js";

function readArg(name) {
  const prefix = `--${name}=`;
  const direct = process.argv.find((item) => item.startsWith(prefix));
  if (direct) return direct.slice(prefix.length).trim();

  const index = process.argv.findIndex((item) => item === `--${name}`);
  if (index >= 0) {
    return String(process.argv[index + 1] || "").trim();
  }
  return "";
}

function requiredValue(label, ...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  throw new Error(`${label} obrigatorio.`);
}

function validatePassword(password) {
  if (password.length < 12) {
    throw new Error("A senha do admin precisa ter pelo menos 12 caracteres.");
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasUpper || !hasLower || !hasDigit) {
    throw new Error("A senha do admin precisa ter maiuscula, minuscula e numero.");
  }
}

async function bootstrapAdmin() {
  const email = requiredValue("Email", readArg("email"), process.env.BOOTSTRAP_ADMIN_EMAIL).toLowerCase();
  const password = requiredValue("Senha", readArg("password"), process.env.BOOTSTRAP_ADMIN_PASSWORD);
  const fullName = requiredValue(
    "Nome completo",
    readArg("full-name"),
    process.env.BOOTSTRAP_ADMIN_FULL_NAME,
    "Administrador"
  );
  const nick = requiredValue("Nick", readArg("nick"), process.env.BOOTSTRAP_ADMIN_NICK, "admin");

  validatePassword(password);
  await ensureDb();

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await findUserByEmail(email);

  let adminUser = null;
  if (existing?.id) {
    await updateUserById(existing.id, {
      role: "admin",
      full_name: fullName,
      nick,
      password_hash: passwordHash,
      account_status: "active",
      terms_accepted: true,
      privacy_accepted: true,
      onboarding_completed: true,
    });
    adminUser = await findUserById(existing.id);
  } else {
    adminUser = await findOrCreateUserByEmail(email, {
      password_hash: passwordHash,
      full_name: fullName,
      nick,
      role: "admin",
      account_status: "active",
      terms_accepted: true,
      privacy_accepted: true,
      onboarding_completed: true,
      avatar_emoji: "🎰",
    });
  }

  console.log("Admin provisionado com sucesso.");
  console.log(`Ambiente: ${env.nodeEnv}`);
  console.log(`Email: ${adminUser.email}`);
  console.log(`User ID: ${adminUser.id}`);
  console.log("Role: admin");
}

bootstrapAdmin()
  .catch((error) => {
    console.error("Falha ao provisionar admin:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
