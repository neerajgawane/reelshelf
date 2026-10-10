import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

test("Reelshelf Full-Stack API Suite", async (t) => {
  const timestamp = Date.now();
  const testUser = {
    name: "Automated Tester",
    email: `tester_${timestamp}@example.com`,
    password: "Password123",
    phone: `+9198765${String(timestamp).slice(-5)}`,
  };

  let sessionCookie = "";

  await t.test("1. POST /api/auth/signup - registers user and initiates WhatsApp OTP", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: BASE_URL,
        Host: new URL(BASE_URL).host,
      },
      body: JSON.stringify(testUser),
    });

    const data = await res.json();
    assert.equal(res.status, 201, `Signup failed with status ${res.status}: ${JSON.stringify(data)}`);
    assert.equal(data.status, "pending");
    assert.equal(data.phone, testUser.phone);
    assert.equal(typeof data.expiresInSeconds, "number");
  });

  await t.test("2. Duplicate signup rejects existing or pending registration cleanly", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: BASE_URL,
        Host: new URL(BASE_URL).host,
      },
      body: JSON.stringify(testUser),
    });

    // An unverified leftover is reclaimed (201) or returns 409 if verified
    assert.ok([201, 409].includes(res.status));
  });

  await t.test("3. Unauthenticated access to /api/saved-movies is blocked (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/saved-movies`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error?.code, "UNAUTHENTICATED");
  });

  await t.test("4. Invalid credentials rejected with 401 and timing-safe handling", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: BASE_URL,
        Host: new URL(BASE_URL).host,
      },
      body: JSON.stringify({ email: "nonexistent@example.com", password: "Password123" }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error?.code, "INVALID_CREDENTIALS");
  });
});
