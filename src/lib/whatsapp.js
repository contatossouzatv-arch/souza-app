export function buildWhatsAppLink(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (/^(wa\.me|api\.whatsapp\.com)\//i.test(raw)) {
    return `https://${raw}`;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits) {
    return `https://wa.me/${digits}`;
  }

  return "";
}
