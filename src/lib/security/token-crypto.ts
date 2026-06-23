import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { requiredEnv } from "@/lib/env";

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function getKey() {
  const key = Buffer.from(requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
