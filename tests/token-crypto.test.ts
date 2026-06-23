import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/security/token-crypto";

describe("refresh token encryption", () => {
  beforeEach(() => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("round trips through AES-256-GCM without storing plaintext", () => {
    const encrypted = encryptSecret("refresh-token-value");
    expect(encrypted.ciphertext).not.toContain("refresh-token-value");
    expect(decryptSecret(encrypted)).toBe("refresh-token-value");
  });

  it("fails authentication when ciphertext is changed", () => {
    const encrypted = encryptSecret("refresh-token-value");
    expect(() => decryptSecret({ ...encrypted, ciphertext: Buffer.from("tampered").toString("base64") })).toThrow();
  });
});
