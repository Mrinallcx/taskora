import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

function key() {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters")
  }
  return Buffer.from(hex, "hex")
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  }
}

export function decryptSecret(row: { iv: string; tag: string; ciphertext: string }) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(row.iv, "base64")
  )
  decipher.setAuthTag(Buffer.from(row.tag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

export function redact(value: string) {
  return value.replace(/(sk-|key_|Bearer )\S+/gi, "[redacted]")
}
