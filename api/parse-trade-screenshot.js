export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    const { imageDataUrl } = req.body || {};

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return res.status(400).json({ success: false, error: "No image provided." });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Missing OPENAI_API_KEY." });
    }

    const prompt = `
You are reading an MT4, MT5, broker, or prop firm trade screenshot.

Extract only visible trade information.
Return JSON only.

Fields:
{
  "pair": "string or null",
  "bias": "Buy, Sell, or Wait",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "entry": number or null,
  "lotSize": number or null,
  "sl": number or null,
  "tp": number or null,
  "rr": "1:2 / 1:3 / etc or null",
  "result": "Win, Loss, BE, or No Trade",
  "notes": "short explanation of what was detected"
}

Rules:
- If order type is Buy, bias is Buy.
- If order type is Sell, bias is Sell.
- If profit is positive, result is Win.
- If profit is negative, result is Loss.
- If profit is zero or very close to zero, result is BE.
- If unsure, use null and explain uncertainty in notes.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imageDataUrl }
            ]
          }
        ],
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data.error?.message || "OpenAI request failed."
      });
    }

    const text =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "{}";

    const trade = JSON.parse(text);

    return res.status(200).json({
      success: true,
      trade
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Scanner error."
    });
  }
}
