import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const encoded = process.env.SHOPEE_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("SHOPEE_TOKEN_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("SHOPEE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(value: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Invalid encrypted secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}

