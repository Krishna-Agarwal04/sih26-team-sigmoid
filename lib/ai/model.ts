import type { z } from "zod";

// Server only. Nothing outside this file reads a model key.
// Plain fetch rather than an SDK because both SDKs default to a 60 second timeout and
// retry on their own, and the whole design here turns on giving up at 8 seconds.

export type ModelOutcome<T> =
  | { ok: true; value: T; modelId: string }
  | { ok: false; reason: string };

interface Ask {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  schemaName: string;
}

function timeoutMs(): number {
  return Number(process.env.AI_TIMEOUT_MS ?? 8000);
}

async function askGroq(ask: Ask): Promise<ModelOutcome<unknown>> {
  const key = process.env.GROQ_API_KEY;
  const modelId = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  if (!key) return { ok: false, reason: "no GROQ_API_KEY" };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs()),
      body: JSON.stringify({
        model: modelId,
        temperature: 0,
        messages: [
          { role: "system", content: ask.system },
          { role: "user", content: ask.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: ask.schemaName, schema: ask.jsonSchema, strict: true },
        },
      }),
    });

    if (!res.ok) return { ok: false, reason: `groq http ${res.status}` };
    const body = await res.json();
    const choice = body.choices?.[0];
    // a truncated object is still valid-looking JSON partway through, so check before parsing
    if (choice?.finish_reason !== "stop") return { ok: false, reason: `groq stopped on ${choice?.finish_reason}` };
    const text = choice.message?.content;
    if (typeof text !== "string") return { ok: false, reason: "groq returned no content" };
    return { ok: true, value: JSON.parse(text), modelId };
  } catch (error) {
    return { ok: false, reason: `groq ${error instanceof Error ? error.name : "failed"}` };
  }
}

// zod stamps a $schema key on its output and Gemini rejects the field
function withoutSchemaKey(schema: Record<string, unknown>): Record<string, unknown> {
  const { $schema, ...rest } = schema;
  void $schema;
  return rest;
}

async function askGemini(ask: Ask): Promise<ModelOutcome<unknown>> {
  const key = process.env.GEMINI_API_KEY;
  const modelId = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  if (!key) return { ok: false, reason: "no GEMINI_API_KEY" };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs()),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: ask.system }] },
          contents: [{ role: "user", parts: [{ text: ask.user }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            // without this it free-forms and fails the zod parse, which makes it no fallback at all
            responseJsonSchema: withoutSchemaKey(ask.jsonSchema),
          },
        }),
      },
    );

    if (!res.ok) return { ok: false, reason: `gemini http ${res.status}` };
    const body = await res.json();
    const text = body.candidates?.[0]?.content?.parts?.find(
      (p: { text?: string }) => typeof p.text === "string",
    )?.text;
    if (typeof text !== "string") return { ok: false, reason: "gemini returned no content" };
    return { ok: true, value: JSON.parse(text), modelId };
  } catch (error) {
    return { ok: false, reason: `gemini ${error instanceof Error ? error.name : "failed"}` };
  }
}

// Groq first, Gemini second, and the caller falls back to the cache when both are gone.
export async function generateJson<T>(ask: Ask, schema: z.ZodType<T>): Promise<ModelOutcome<T>> {
  const reasons: string[] = [];

  for (const provider of [askGroq, askGemini]) {
    const raw = await provider(ask);
    if (!raw.ok) {
      reasons.push(raw.reason);
      continue;
    }
    const parsed = schema.safeParse(raw.value);
    if (!parsed.success) {
      reasons.push(`${raw.modelId} broke the schema`);
      continue;
    }
    return { ok: true, value: parsed.data, modelId: raw.modelId };
  }

  return { ok: false, reason: reasons.join("; ") };
}
