function parseJsonLenient(raw) {
  if (!raw || typeof raw !== "string") return null;

  try {
    return JSON.parse(raw);
  } catch {}

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1).trim();
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  return null;
}

function readGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

async function openAiJson({ prompt, apiKey, model }) {
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: "Return strict JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI API error ${response.status}: ${detail || "Request failed"}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;

  return parseJsonLenient(content);
}

async function geminiJson({ prompt, apiKey, model }) {
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Return strict JSON only.\n\n${prompt}` }] }],
        generationConfig: { temperature: 0 }
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${detail || "Request failed"}`);
  }

  const data = await response.json();
  const content = readGeminiText(data);
  if (!content) return null;
  return parseJsonLenient(content);
}

async function openAiText({ prompt, apiKey, model }) {
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Be concise and specific." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
}

async function geminiText({ prompt, apiKey, model }) {
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `Be concise and specific.\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.2 }
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${detail || "Request failed"}`);
  }

  const data = await response.json();
  const content = readGeminiText(data);
  return content || null;
}

export async function llmJson({ prompt, apiKey, model = "gpt-4.1-mini", provider = "openai" }) {
  const normalized = String(provider || "openai").toLowerCase();
  if (normalized === "gemini") {
    return geminiJson({ prompt, apiKey, model });
  }
  return openAiJson({ prompt, apiKey, model });
}

export async function llmText({ prompt, apiKey, model = "gpt-4.1-mini", provider = "openai" }) {
  const normalized = String(provider || "openai").toLowerCase();
  if (normalized === "gemini") {
    return geminiText({ prompt, apiKey, model });
  }
  return openAiText({ prompt, apiKey, model });
}
