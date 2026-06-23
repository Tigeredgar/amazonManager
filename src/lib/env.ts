import "server-only";

const production = process.env.NODE_ENV === "production";

export function isDemoMode() {
  if (production) return false;
  return process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;
}

export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function reminderRecipients() {
  return (process.env.REMINDER_RECIPIENTS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
