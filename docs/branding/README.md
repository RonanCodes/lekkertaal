# Branding: Lekkertaal treat mascot family + palette proposals

> Reviewable exploration only. The live app palette lives in `src/styles.css` and is NOT changed by this document or the accompanying files.

See also: branding research [#184](https://github.com/RonanCodes/lekkertaal/issues/184), implementation slice [#186](https://github.com/RonanCodes/lekkertaal/issues/186).

---

## 1. Stroop — the canonical mascot

`public/mascot/stroop-512.png` is the reference character: a round stroopwafel with big shiny eyes, rosy cheeks, and an orange bowtie. Generated with Imagen 4 Ultra; see `public/mascot/PROMPT.md` for the full prompt and iteration notes.

The treat family below matches this style: friendly cartoon, clean vector feel, solid white background, no text in the image.

---

## 2. Dutch-treat mascot family

Eight characters in `public/mascot/treats/<treat>/`, each with three expression frames.

| Treat | Slug | Description |
|---|---|---|
| Kroket | `kroket` | Golden-brown croquette log. Deep-fried, crispy outside, creamy ragout inside. |
| Bitterballen | `bitterballen` | Round fried snack, Dutch bar staple. Usually served with mustard. |
| Oliebollen | `oliebollen` | Deep-fried dough balls dusted with powdered sugar. New Year's Eve tradition. |
| Drop | `drop` | Black licorice. Salty or sweet, fiercely divisive. Netherlands' #1 candy. |
| Poffertjes | `poffertjes` | Mini puffy pancakes, served with butter and powdered sugar. |
| Frikandel | `frikandel` | Fried minced-meat sausage. Snack-bar (snackbar) classic. |
| Tompouce | `tompouce` | Rectangular pastry with pink fondant top and cream filling. Bakkerij staple. |
| Kaas | `kaas` | Gouda cheese wedge. The Netherlands exports more cheese than any other country. |

### Expression frames

| Expression | File | Animation class | Use case |
|---|---|---|---|
| Idle | `idle.png` | `.anim-idle-bob` | Default resting state |
| Happy | `happy.png` | `.anim-happy-bounce` | Correct answer, XP gain, streak milestone |
| Surprised | `surprised.png` | `.anim-surprised-pop` | Wrong answer, reveal, unexpected event |

### CSS animations

```css
@keyframes idle-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
/* animation: idle-bob 2.5s ease-in-out infinite */

@keyframes happy-bounce {
  0%   { transform: translateY(0) scaleY(1) scaleX(1); }
  30%  { transform: translateY(-10px) scaleY(1.05) scaleX(0.95); }
  60%  { transform: translateY(0) scaleY(0.95) scaleX(1.05); }
  80%  { transform: translateY(-4px) scaleY(1.02) scaleX(0.98); }
  100% { transform: translateY(0) scaleY(1) scaleX(1); }
}
/* animation: happy-bounce 0.5s ease-in-out infinite */

@keyframes surprised-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.2); }
  70%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}
/* animation: surprised-pop 0.3s ease-in-out infinite */
```

### Generation notes

Generated via Gemini Imagen 4 Fast (`imagen-4.0-fast-generate-001`) using the same style prompt as Stroop. 24 images total (8 treats x 3 expressions), all at default resolution (~1024px), stored as PNG. The white background can be alpha-keyed with PIL flood-fill if transparent PNGs are needed for composition.

---

## 3. Palette proposals

Three complete CSS custom-property token sets in `src/styles/palettes/`. Each file is a drop-in replacement for the `@theme` and `:root` blocks in `src/styles.css` — every `--color-*`, `--surface-*`, `--text-*`, and `--line-*` token is present and follows the same naming convention.

To preview all three side-by-side: `pnpm dev` then visit `/styleguide`.

### Candy

File: `src/styles/palettes/candy.css`

Vivid, high-saturation colours inspired by Dutch hagelslag (sprinkle candy) and sweet-shop treats. Bright pinks, electric purples, and citrus yellows.

| Token | Hex | Notes |
|---|---|---|
| `--color-brand-orange` | `#FF3E9A` | Hot pink primary CTA |
| `--color-brand-orange-dark` | `#C4006E` | CTA shadow / pressed state |
| `--color-brand-orange-soft` | `#FFD6EC` | Soft banner tint |
| `--color-brand-blue` | `#7B2FFF` | Electric purple for secondary actions |
| `--color-brand-blue-dark` | `#5500CC` | Secondary shadow |
| `--color-paper` | `#FFF5FB` | Page background, faint pink tint |
| `--color-good` | `#2DBE6C` | Success green |
| `--color-warn` | `#FFB800` | Warning amber |
| `--color-bad` | `#FF2D55` | Error red |

Best for: seasonal promotions, younger learners, social/viral moments.

---

### Warm Bakery

File: `src/styles/palettes/warm-bakery.css`

Terracotta primary, dark rye ink, parchment surfaces. Inspired by Dutch bakkerij interiors: golden croissant crusts, amber pastry-case light.

| Token | Hex | Notes |
|---|---|---|
| `--color-brand-orange` | `#D4600A` | Deep terracotta CTA |
| `--color-brand-orange-dark` | `#9E4200` | CTA shadow |
| `--color-brand-orange-soft` | `#FAEADB` | Soft banner tint |
| `--color-brand-blue` | `#5A6E2E` | Olive green accent (herb / herb garden) |
| `--color-brand-blue-dark` | `#3C4A1A` | Accent shadow |
| `--color-paper` | `#FDF6EC` | Warm parchment background |
| `--color-good` | `#4A8A3A` | Muted forest green |
| `--color-warn` | `#B87C10` | Dark amber |
| `--color-bad` | `#A83030` | Dark red |

Best for: premium positioning, adult learners, heritage / traditional feel.

---

### Vibrant

File: `src/styles/palettes/vibrant.css`

Electric teal paired with Dutch orange at maximum saturation. The Duolingo-green equivalent for Lekkertaal: loud, fast, gamified.

| Token | Hex | Notes |
|---|---|---|
| `--color-brand-orange` | `#FF5500` | Pure electric orange CTA |
| `--color-brand-orange-dark` | `#CC3A00` | CTA shadow |
| `--color-brand-orange-soft` | `#FFE8DC` | Soft banner tint |
| `--color-brand-blue` | `#00A8CC` | Electric teal accent |
| `--color-brand-blue-dark` | `#007A99` | Teal shadow |
| `--color-paper` | `#F5FEFF` | Near-white with faint cyan tint |
| `--color-good` | `#00CC66` | Bright mint green |
| `--color-warn` | `#FFAA00` | Bright amber |
| `--color-bad` | `#FF2244` | Electric red |

Best for: competitive leaderboard focus, dark-mode-first variant, gamification-heavy sprints.

---

## 4. How to adopt a palette

1. Open `src/styles.css`.
2. Locate the `@theme { ... }` block and the `/* Semantic surface tokens */` `:root { ... }` block.
3. Copy the content from your chosen palette file in `src/styles/palettes/`.
4. Replace the `@theme` block and the `:root` light-mode block.
5. Update the `@media (prefers-color-scheme: dark)` `:root { ... }` block to match — the palette files do not include dark-mode overrides; those need design decisions for each palette direction.
6. Run `pnpm build && pnpm typecheck` to confirm no token names were missed.
7. Do a visual review at `/styleguide` and across the main app routes.

The palette files use identical token names to the current theme, so no component or Tailwind class changes are needed.
