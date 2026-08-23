// Netlify Function: /.netlify/functions/chat
// Backs the site-wide mini chatbot with a real AI answer (Anthropic Claude),
// grounded on the current page's own FAQ content so it stays accurate and cheap.
//
// Setup (one-time):
//   1. Create an API key at https://console.anthropic.com (Settings -> API Keys).
//   2. In Netlify: Site settings -> Environment variables -> add ANTHROPIC_API_KEY.
//   3. Deploy (git push). No extra build step or dependencies are needed --
//      this function only uses Node's built-in fetch (Node 18+ on Netlify).
//
// If ANTHROPIC_API_KEY is not set, this function returns a clear error and the
// chat widget on the page automatically falls back to its offline FAQ search,
// so the site keeps working either way.

const MODEL = "claude-3-5-haiku-20241022"; // fast + inexpensive; change if you prefer a different Claude model
const MAX_MESSAGE_LEN = 800;
const MAX_FAQ_ITEMS = 12;
const MAX_FAQ_Q_LEN = 300;
const MAX_FAQ_A_LEN = 800;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return respond(500, {
      error: "not_configured",
      message: "The AI chatbot isn't set up yet (missing ANTHROPIC_API_KEY in Netlify environment variables).",
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return respond(400, { error: "Invalid JSON body" });
  }

  const message = String(payload.message || "").slice(0, MAX_MESSAGE_LEN).trim();
  if (!message) {
    return respond(400, { error: "Empty message" });
  }
  const pageTitle = String(payload.pageTitle || "").slice(0, 200);
  const pageUrl = String(payload.pageUrl || "").slice(0, 200);
  const pageFaqs = Array.isArray(payload.pageFaqs) ? payload.pageFaqs.slice(0, MAX_FAQ_ITEMS) : [];

  const faqContext = pageFaqs.length
    ? pageFaqs
        .map(function (item, i) {
          const q = String((item && item.q) || "").slice(0, MAX_FAQ_Q_LEN);
          const a = String((item && item.a) || "").slice(0, MAX_FAQ_A_LEN);
          return (i + 1) + ". Q: " + q + "\n   A: " + a;
        })
        .join("\n\n")
    : "(no FAQ content available for this page)";

  const systemPrompt = [
    'You are the small help assistant embedded on paktaxcalculator.net, a Pakistan income tax, sales tax, withholding tax, and Zakat calculator website.',
    'Current page: "' + pageTitle + '" (' + pageUrl + ').',
    "Answer the visitor's question clearly and concisely -- 2 to 5 short sentences, plain text, no markdown headers or bullet lists.",
    "Prefer the FAQ content below (written for this exact page) as your source of truth whenever it's relevant:",
    faqContext,
    "If the question is unrelated to Pakistani tax, sales tax, withholding tax, or Zakat, politely say this assistant only covers those topics and point them to the site's search bar.",
    "Do not invent specific tax rates, thresholds, or figures beyond what's in the FAQ content above or what you are confident is accurate -- if unsure, say so plainly and suggest checking the relevant calculator on this site or confirming with FBR / a qualified tax advisor.",
    "Never claim to give personalized legal, financial, or religious advice -- you provide general information only.",
  ].join("\n\n");

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return respond(502, { error: "upstream_error", detail: errText.slice(0, 300) });
    }

    const data = await upstream.json();
    const reply =
      data && data.content && data.content[0] && data.content[0].text
        ? data.content[0].text
        : "Sorry, I couldn't generate a reply just now.";

    return respond(200, { reply: reply });
  } catch (err) {
    return respond(500, { error: "server_error", detail: String(err).slice(0, 300) });
  }
};

function respond(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}
