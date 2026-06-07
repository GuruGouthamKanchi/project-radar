import { generateE2EKey, encryptLocation, decryptLocation } from "../lib/crypto";

describe("generateE2EKey()", () => {

  test("returns a string", () => {
    expect(typeof generateE2EKey()).toBe("string");
  });

  test("returns a 16-character key", () => {
    expect(generateE2EKey()).toHaveLength(16);
  });

  test("generates unique keys each time", () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateE2EKey()));
    expect(keys.size).toBe(20);
  });

  test("key contains only alphanumeric characters", () => {
    const key = generateE2EKey();
    expect(/^[a-zA-Z0-9]+$/.test(key)).toBe(true);
  });

});

describe("encryptLocation() / decryptLocation()", () => {

  const password = generateE2EKey();
  const originalData = { lat: 13.0827, lng: 80.2707, heading: null };

  test("encryptLocation returns a non-empty string", async () => {
    const cipher = await encryptLocation(originalData, password);
    expect(typeof cipher).toBe("string");
    expect(cipher.length).toBeGreaterThan(0);
  });

  test("encrypted output is different from input", async () => {
    const cipher = await encryptLocation(originalData, password);
    expect(cipher).not.toContain("13.0827");
    expect(cipher).not.toContain("80.2707");
  });

  test("decryptLocation recovers the original coordinates", async () => {
    const cipher = await encryptLocation(originalData, password);
    const decrypted = await decryptLocation(cipher, password);
    expect(decrypted.lat).toBeCloseTo(originalData.lat, 4);
    expect(decrypted.lng).toBeCloseTo(originalData.lng, 4);
  });

  test("decrypt with wrong password throws or returns garbage", async () => {
    const cipher = await encryptLocation(originalData, password);
    try {
      const result = await decryptLocation(cipher, "wrongpassword1234");
      expect(result.lat).not.toBeCloseTo(originalData.lat, 1);
    } catch {
      expect(true).toBe(true);
    }
  });

  test("encrypting same data twice gives different ciphertext (IV randomness)", async () => {
    const cipher1 = await encryptLocation(originalData, password);
    const cipher2 = await encryptLocation(originalData, password);
    expect(cipher1).not.toBe(cipher2);
  });

  test("handles heading: null correctly", async () => {
    const cipher = await encryptLocation(originalData, password);
    const decrypted = await decryptLocation(cipher, password);
    expect(decrypted.heading).toBeNull();
  });

  test("handles a real heading value correctly", async () => {
    const withHeading = { lat: 13.0827, lng: 80.2707, heading: 45.5 };
    const cipher = await encryptLocation(withHeading, password);
    const decrypted = await decryptLocation(cipher, password);
    expect(decrypted.heading).toBeCloseTo(45.5, 1);
  });

});
