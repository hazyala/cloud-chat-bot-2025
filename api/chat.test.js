import assert from "node:assert/strict";
import { test } from "node:test";
import handler from "./chat.js";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "../shared/geminiModels.js";

function setEnv(t, name, value) {
  const previous = process.env[name];
  process.env[name] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

function response() {
  return {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {}
  };
}

test("supported models use the REST contract and preserve conversation roles", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.ok(url.endsWith(":generateContent"));
    assert.ok(!url.includes("key="));
    assert.equal(options.headers["x-goog-api-key"], "test-key");
    const { contents, generationConfig } = JSON.parse(options.body);
    assert.deepEqual(contents.map((item) => item.role), ["user", "model", "user"]);
    assert.equal(generationConfig.maxOutputTokens, 8192);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [
      { thought: true, text: "internal" }, { text: "안녕하세요" }
    ] } }] }));
  });
  setEnv(t, "GEMINI_API_KEY", "test-key");
  for (const { id } of GEMINI_MODELS) {
    const result = response();
    await handler({ method: "POST", body: { model: id, messages: [
      { role: "user", content: "처음" }, { role: "assistant", content: "답변" },
      { role: "user", content: "다음" }
    ] } }, result);
    assert.equal(result.code, 200);
    assert.deepEqual(result.body, { answer: "안녕하세요" });
  }
});

test("default model and upstream errors", async (t) => {
  setEnv(t, "GEMINI_API_KEY", "test-key");
  setEnv(t, "GEMINI_DEFAULT_MODEL", DEFAULT_GEMINI_MODEL);
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.ok(url.includes(`/${DEFAULT_GEMINI_MODEL}:`));
    return new Response(JSON.stringify({ error: { message: "quota exceeded" } }), { status: 429 });
  });
  const result = response();
  await handler({ method: "POST", body: { messages: [{ role: "user", content: "hello" }] } }, result);
  assert.equal(result.code, 429);
  assert.match(result.body.error, /quota exceeded/);
});

test("invalid messages fail before calling Gemini", async (t) => {
  setEnv(t, "GEMINI_API_KEY", "test-key");
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("unexpected call"); });
  for (const messages of [undefined, {}, [null], [{ role: "user", content: 1 }], []]) {
    const result = response();
    await handler({ method: "POST", body: { messages } }, result);
    assert.equal(result.code, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

