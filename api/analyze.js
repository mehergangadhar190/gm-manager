export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured in Vercel."
    });
  }

  try {
    const { images } = req.body || {};

    if (!Array.isArray(images) || images.length < 1 || images.length > 3) {
      return res.status(400).json({
        error: "Send 1–3 images."
      });
    }

    const parts = [
      {
        text: `
You are GM Manager, a personal Instagram and social-media manager.

Analyze the supplied 1–3 photos and choose the best photo for an Instagram post.

Focus only on visible photographic qualities.

The user's preferred style is:
- Natural
- Premium
- Simple
- Clean
- Professional
- Human-looking
- High quality
- Not obviously AI-generated
- Not over-edited

For pose recommendations:
- Recommend natural poses.
- Never recommend changing facial identity.
- Never recommend changing face structure.
- Never recommend changing body proportions.
- Never recommend changing body size or shape.

For editing:
- Recommend subtle improvements only.
- Avoid unnecessary background replacement.
- Preserve the original environment whenever possible.

For posting time:
- If real Instagram audience analytics are unavailable, clearly treat the time as a starter recommendation.
- Never pretend that invented audience data is real.

Return ONLY valid JSON.

Use exactly these keys:

{
  "bestIndex": 0,
  "score": 0,
  "why": "",
  "aesthetic": "",
  "pose": "",
  "composition": "",
  "editing": "",
  "music": "",
  "postingTime": "",
  "caption": ""
}

bestIndex must be the zero-based index of the best supplied photo.

score must be an integer from 0 to 100.

The caption should be short, natural and confident.
`
      }
    ];

    for (const dataUrl of images) {
      const match = String(dataUrl).match(
        /^data:(image\\/[^;]+);base64,(.+)$/
      );

      if (!match) {
        continue;
      }

      parts.push({
        inline_data: {
          mime_type: match[1],
          data: match[2]
        }
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },
        body: JSON.stringify({
          contents: [
            {
              parts
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini analysis failed."
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.find(
        part => part.text
      )?.text;

    if (!text) {
      throw new Error("No analysis returned.");
    }

    const result = JSON.parse(text);

    return res.status(200).json({
      result
    });

  } catch (error) {
    return res.status(500).json({
      error:
        error?.message ||
        "GM photo analysis failed."
    });
  }
}
