export function generateE2EKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function deriveKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const hash = await window.crypto.subtle.digest("SHA-256", passwordBytes);
  return window.crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function fallbackEncrypt(text: string, key: string): string {
  const salt = Math.random().toString(36).substring(2, 10).padEnd(8, '0');
  const salted = salt + text;
  const code = salted.split("").map((c, i) => {
    return c.charCodeAt(0) ^ key.charCodeAt(i % key.length);
  });
  return "fb:" + salt + btoa(JSON.stringify(code));
}

function fallbackDecrypt(ciphertext: string, key: string): string {
  let cleanText = ciphertext;
  if (ciphertext.startsWith("fb:")) {
    cleanText = ciphertext.substring(3);
  }
  try {
    const xorResult = cleanText.substring(8);
    const decoded = JSON.parse(atob(xorResult));
    const decryptedSalted = decoded
      .map((c: number, i: number) => {
        return String.fromCharCode(c ^ key.charCodeAt(i % key.length));
      })
      .join("");
    return decryptedSalted.substring(8);
  } catch {
    throw new Error("Fallback decryption failed");
  }
}

export async function encryptLocation(
  data: { lat: number; lng: number; heading: number | null },
  password: string
): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    return fallbackEncrypt(JSON.stringify(data), password);
  }
  try {
    const key = await deriveKey(password);
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encodedData
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    let binary = "";
    for (let i = 0; i < combined.length; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error("AES encryption failed, using fallback:", e);
    return fallbackEncrypt(JSON.stringify(data), password);
  }
}

export async function decryptLocation(
  ciphertext: string,
  password: string
): Promise<{ lat: number; lng: number; heading: number | null }> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    return JSON.parse(fallbackDecrypt(ciphertext, password));
  }
  if (ciphertext.startsWith("fb:")) {
    return JSON.parse(fallbackDecrypt(ciphertext, password));
  }
  try {
    const key = await deriveKey(password);
    const combined = new Uint8Array(
      atob(ciphertext)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    console.error("AES decryption failed, trying fallback:", e);
    try {
      return JSON.parse(fallbackDecrypt(ciphertext, password));
    } catch {
      throw new Error("Decryption failed");
    }
  }
}
