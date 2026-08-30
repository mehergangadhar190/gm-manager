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
    const { image, prompt } = req.body || {};

    const match = String(image || "").match(
      /^data:(image\/[^;]+);base64,(.+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: "A valid image is required."
      });
    }

    if (match[2].length > 14000000) {
      return res.status(413).json({
        error: "Image is too large. Please use a smaller photo."
      });
    }

    const instruction = `
${prompt || "Change the person's pose to a natural and relaxed pose."}

GM MANAGER — STRICT PHOTO RULES:

1. Preserve the exact person's identity.
2. Do NOT change facial identity.
3. Do NOT change face structure.
4. Do NOT slim, enlarge, reshape or modify the person's body.
5. Do NOT change body proportions.
6. Do NOT change body size or shape.
7. Preserve clothing.
8. Preserve hairstyle.
9. Preserve natural skin texture.
10. Keep the original background/environment as much as possible.
11. Do not replace the environment unnecessarily.
12. Only change the requested pose.
13. Keep lighting realistic.
14. Keep colors natural.
15. Do not add unrelated people or objects.
16. The final result must look like a genuine camera photograph.
17. Avoid an obvious AI-generated appearance.

The requested pose should look physically realistic and natural.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: match[1],
                    data: match[2]
                  }
                },
                {
                  text: instruction
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["IMAGE"]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini image editing failed."
      });
    }

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      part =>
        part?.inlineData?.data ||
        part?.inline_data?.data
    );

    const base64 =
      imagePart?.inlineData?.data ||
      imagePart?.inline_data?.data;

    const mimeType =
      imagePart?.inlineData?.mimeType ||
      imagePart?.inline_data?.mime_type ||
      "image/png";

    if (!base64) {
      throw new Error(
        "The image model did not return an edited image."
      );
    }

    return res.status(200).json({
      image: `data:${mimeType};base64,${base64}`
    });

  } catch (error) {
    return res.status(500).json({
      error:
        error?.message ||
        "GM image editing failed."
    });
  }
}
