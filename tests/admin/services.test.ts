import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockResponse = { statusCode: number; body: Record<string, unknown> | null; status: (code: number) => MockResponse; json: (body: Record<string, unknown>) => void };

function response(): MockResponse {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

describe("summary modes", () => {
  const prompts: string[] = [];

  beforeEach(() => {
    prompts.length = 0;
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
      const payload = JSON.parse(String(options.body));
      prompts.push(payload.contents[0].parts[0].text);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"cleanedText":"원문","summary":"요약"}' }] } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it.each([
    ["표준", "핵심 사건과 감정을 짧고 직접적인"],
    ["고급", "감정의 맥락을 균형 있게"],
    ["최고", "감정의 뉘앙스를 놓치지 않되"],
  ])("sends a concrete instruction for %s", async (quality, instruction) => {
    const handler = require("../../api/services");
    const res = response();
    await handler({ method: "POST", url: "/api/services?action=summarize", body: { text: "원문", quality } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ quality });
    expect(prompts[0]).toContain(`요약 방식: ${quality}`);
    expect(prompts[0]).toContain(instruction);
  });
});
