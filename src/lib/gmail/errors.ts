export const GMAIL_REAUTH_REQUIRED =
  "Gmail authorization expired or was revoked. Reconnect Gmail in Settings.";

export function isInvalidGrantError(cause: unknown) {
  if (!cause || typeof cause !== "object") return false;
  const maybe = cause as {
    code?: unknown;
    message?: unknown;
    response?: { data?: { error?: unknown; error_description?: unknown } };
  };
  return (
    (maybe.code === 400 && maybe.response?.data?.error === "invalid_grant") ||
    (typeof maybe.message === "string" && maybe.message.includes("invalid_grant")) ||
    (typeof maybe.response?.data?.error_description === "string" &&
      maybe.response.data.error_description.includes("invalid_grant"))
  );
}

export function syncErrorMessage(cause: unknown) {
  if (isInvalidGrantError(cause)) return GMAIL_REAUTH_REQUIRED;
  return cause instanceof Error ? cause.message : "Unknown Gmail synchronization error";
}
