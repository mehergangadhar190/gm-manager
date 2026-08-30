export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).end(JSON.stringify({
      error: "Method not allowed"
    }));
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).end(JSON.stringify({
      error: "GEMINI_API_KEY is missing in Vercel."
    }));
  }

  try {
    const { image, prompt } = req.body || {};

    if (!image) {
      return res.status(400).end(JSON.stringify({
        error: "No photo was supplied."
      }));
    }

    const match = String(image).match(
      /^data:(image\/[^;]+);base64,(.+)$/
    );

    if (!match) {
      return res.status(400).end(JSON.stringify({
        error: "Invalid photo format."
      }));
    }

    const mimeType = match[1];
    const base64Image = match[2];

    const instruction = `
GM Manager Natural Pose Editor.

Change ONLY the person's pose.

STRICT REQUIREMENTS:
- Preserve the exact identity of the person.
- Preserve the face and facial identity.
- Do not change facial structure.
- Do not change body size.
- Do not change body shape.
- Do not change body proportions.
- Do not slim or enlarge the person.
- Preserve clothing.
- Preserve hairstyle.
- Preserve skin appearance.
- Preserve the original environment and background.
- Do not replace the background.
- Do not add unrelated people or objects.
- Keep realistic lighting.
- Keep realistic shadows.
- Make the result look like a genuine photograph.
- Avoid an obvious AI-generated appearance.

The new pose must be physically realistic and natural.

User's requested pose:
${prompt || "Make the pose look more natural, relaxed and confident."}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-image",
          input: [
            {
              type: "image",
              data: base64Image,
              mime_type: mimeType
            },
            {
              type: "text",
              text: instruction
            }
          ],
          response_format: {
            type: "image"
          }
        })
      }
    );

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(502).end(JSON.stringify({
        error: "Gemini returned an invalid response."
      }));
    }

    if (!response.ok) {
      return res.status(response.status).end(JSON.stringify({
        error:
          data?.error?.message ||
          "Gemini image editing failed."
      }));
    }

    let generatedImage = null;
    let generatedMime = "image/png";

    if (data?.output_image?.data) {
      generatedImage = data.output_image.data;
      generatedMime =
        data.output_image.mime_type || "image/png";
    }

    if (!generatedImage && Array.isArray(data?.steps)) {
      for (const step of data.steps) {
        if (
          step?.type === "model_output" &&
          Array.isArray(step.content)
        ) {
          for (const block of step.content) {
            if (
              block?.type === "image" &&
              block?.data
            ) {
              generatedImage = block.data;
              generatedMime =
                block.mime_type || "image/png";
              break;
            }
          }
        }

        if (generatedImage) break;
      }
    }

    if (!generatedImage) {
      return res.status(502).end(JSON.stringify({
        error:
          "Gemini completed the request but did not return an edited image."
      }));
    }

    return res.status(200).end(JSON.stringify({
      image: `data:${generatedMime};base64,${generatedImage}`
    }));

  } catch (error) {
    return res.status(500).end(JSON.stringify({
      error:
        error?.message ||
        "GM natural pose generation failed."
    }));
  }
}
