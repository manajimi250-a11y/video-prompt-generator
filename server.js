require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "30mb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res) => {
      // Always fetch the latest HTML/CSS/JS so updates show up immediately after each deploy
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    },
  })
);

async function handleAnthropic(system, messages, max_tokens) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY تنظیم نشده. فایل .env را بررسی کن.");
    err.status = 500;
    throw err;
  }

  // Claude does not support audio input; drop any audio blocks as a safety net
  const safeMessages = messages.map((m) => ({
    ...m,
    content: Array.isArray(m.content) ? m.content.filter((b) => b.type !== "audio") : m.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: max_tokens || 1000,
      system,
      messages: safeMessages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || "خطا در ارتباط با Anthropic API");
    err.status = response.status;
    throw err;
  }
  // Already in the normalized shape: { content: [{ type: "text", text }] }
  return data;
}

// تبدیل پیام‌های به فرمت Anthropic (که فرانت‌اند می‌سازد) به فرمت Gemini
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: (Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }]).map((block) => {
      if (block.type === "image" || block.type === "audio") {
        return { inline_data: { mime_type: block.source.media_type, data: block.source.data } };
      }
      return { text: block.text };
    }),
  }));
}

async function handleGemini(system, messages, max_tokens) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY تنظیم نشده. فایل .env را بررسی کن.");
    err.status = 500;
    throw err;
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const body = {
    contents: toGeminiContents(messages),
    generationConfig: { maxOutputTokens: max_tokens || 1000 },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || "خطا در ارتباط با Gemini API");
    err.status = response.status;
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("\n") || "";

  // نرمال‌سازی به همون فرمتی که فرانت‌اند از Anthropic انتظار داره
  return { content: [{ type: "text", text }] };
}

// یک مسیر واحد که هم Claude و هم Gemini از آن عبور می‌کنند
app.post("/api/generate", async (req, res) => {
  try {
    const { provider = "anthropic", system, messages, max_tokens } = req.body;
    if (!messages) {
      return res.status(400).json({ error: "درخواست نامعتبر است." });
    }

    // Diagnostic logging — visible in Render's Logs tab
    const lastMsg = messages[messages.length - 1];
    const textBlock = Array.isArray(lastMsg?.content)
      ? lastMsg.content.find((b) => b.type === "text")?.text
      : lastMsg?.content;
    console.log(`[${new Date().toISOString()}] provider=${provider} userText="${(textBlock || "").slice(0, 120)}"`);

    const data =
      provider === "gemini"
        ? await handleGemini(system, messages, max_tokens)
        : await handleAnthropic(system, messages, max_tokens);

    const resultPreview = data?.content?.[0]?.text?.slice(0, 120) || "";
    console.log(`[${new Date().toISOString()}] result preview: "${resultPreview}"`);

    res.json(data);
  } catch (err) {
    console.error("خطای سرور:", err.message);
    res.status(err.status || 500).json({ error: err.message || "خطای داخلی سرور" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ سرور روشن شد: http://localhost:${PORT}`);
  console.log("برای توقف سرور: Ctrl+C");
});

