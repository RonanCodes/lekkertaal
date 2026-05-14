# Stroop mascot generation

## Final prompt

> A friendly cartoon stroopwafel mascot character. Round caramel biscuit body with a brown waffle grid pattern, big expressive shiny brown eyes, warm welcoming smile, soft rosy cheeks. Soft cream-and-amber palette. A small orange (#FF6B1A) bow tie at the bottom centre. Hand-drawn cosy children's app feel, clean vector style, slight 3/4 front view, gentle soft shading. Single centered character on a perfectly flat solid pure white #FFFFFF background. No accessories, no hat, no cap, no text, no letters, no words, no logo, no labels, no name, no signage, no shadow on the background. Just the waffle character and the bow tie.

## Tool

- Provider: Google Gemini (Imagen)
- Model: `imagen-4.0-ultra-generate-001`
- Parameters: `{sampleCount: 1, aspectRatio: "1:1"}`
- Output: 1024x1024 PNG, RGB on solid white background

OpenAI `gpt-image-1` (the original first choice in the issue) was unavailable at generation time due to a billing hard-limit on the account. Imagen 4 Ultra was used as the documented fallback.

## Post-processing

Imagen does not emit a native transparent-background mode. The output white background was keyed to alpha via a Python/PIL flood-fill from the image edges (threshold R,G,B > 235) so the character body, eyes, and bow tie retain their colour while the surrounding pixels become transparent.

The 1024x1024 master was then resized via macOS `sips` to:

- `stroop-512.png` (landing hero)
- `stroop-192.png` (PWA icon size)
- `stroop-64.png` (header / favicon-adjacent)

## Regeneration

To regenerate from scratch:

```bash
set -a; . ./.dev.vars; set +a

PROMPT="$(cat PROMPT.md | sed -n '/^> /p' | sed 's/^> //')"

curl -sS "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict?key=$GOOGLE_GENERATIVE_AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" '{instances:[{prompt:$p}], parameters:{sampleCount:1, aspectRatio:"1:1"}}')" \
  -o /tmp/imagen.json

jq -r '.predictions[0].bytesBase64Encoded' /tmp/imagen.json | base64 -d > /tmp/stroop-raw.png
# then run the alpha-keying script and sips resize loop
```

## Iteration notes

Took 4 attempts on Imagen Ultra to converge:

1. Default prompt produced a grey-baked "transparent-style" checkerboard pattern as the actual background. Not usable.
2. "Solid pure white background" prompt fixed the background but Imagen wrote "Stroop" as text in the image.
3. Restated "no text, no letters, no words" + slight 3/4 view; result still added a "Stroop" hat with text on it.
4. Explicit "no accessories, no hat, no cap, no text" plus listing the allowed elements ("just the waffle character and the bow tie"). This was the keeper.

Estimated cost across the 4 attempts: roughly $0.16 on Imagen 4 Ultra ($0.04 / image at high quality).
