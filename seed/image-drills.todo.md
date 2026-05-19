# Image drills — generation checklist

Generate each of the 40 images via `/ro:generate-image`, upload to R2,
then merge `seed/image-drills.json` into `seed/exercises.json` (or extend
`scripts/seed-load.ts` to read the file directly).

Public base URL: `https://pub-7dc3882d3fb04b9796d2b3c78f56db6c.r2.dev`

| # | Noun | Article | EN | Image prompt |
| - | ---- | ------- | -- | ------------ |
| 1 | `kat` | de | cat | Photo of a tabby cat sitting on a wooden floor, neutral background. |
| 2 | `hond` | de | dog | Photo of a brown dog sitting in a park, side view. |
| 3 | `boek` | het | book | Photo of an open hardback book on a plain table, top-down. |
| 4 | `stoel` | de | chair | Photo of a single wooden dining chair against a white wall. |
| 5 | `tafel` | de | table | Photo of a plain wooden kitchen table, empty, three-quarter view. |
| 6 | `huis` | het | house | Photo of a small Dutch terraced house with a red door. |
| 7 | `auto` | de | car | Photo of a small parked city car on a quiet street. |
| 8 | `fiets` | de | bicycle | Photo of a black Dutch city bicycle leaning against a wall. |
| 9 | `appel` | de | apple | Photo of a single red apple on a white plate. |
| 10 | `banaan` | de | banana | Photo of a yellow banana on a wooden cutting board. |
| 11 | `brood` | het | bread | Photo of a loaf of crusty brown bread on a board. |
| 12 | `kaas` | de | cheese | Photo of a wedge of yellow Gouda cheese. |
| 13 | `water` | het | water | Photo of a clear glass of water on a table. |
| 14 | `koffie` | de | coffee | Photo of a white cup of black coffee, top-down. |
| 15 | `melk` | de | milk | Photo of a glass jug of milk on a kitchen counter. |
| 16 | `ei` | het | egg | Photo of a single white egg in an egg cup. |
| 17 | `tomaat` | de | tomato | Photo of a single ripe red tomato on a wooden surface. |
| 18 | `wortel` | de | carrot | Photo of an orange carrot with green tops on a board. |
| 19 | `deur` | de | door | Photo of a wooden front door with a brass handle. |
| 20 | `raam` | het | window | Photo of a single residential window with white frames. |
| 21 | `trap` | de | staircase | Photo of a narrow wooden staircase indoors. |
| 22 | `klok` | de | clock | Photo of a round wall clock with black hands. |
| 23 | `sleutel` | de | key | Photo of a single metal house key on a plain surface. |
| 24 | `tas` | de | bag | Photo of a brown leather shoulder bag on a chair. |
| 25 | `schoen` | de | shoe | Photo of a single brown leather shoe, side view. |
| 26 | `jas` | de | coat | Photo of a dark wool coat on a coat hanger. |
| 27 | `hoed` | de | hat | Photo of a brown felt hat on a wooden surface. |
| 28 | `trui` | de | sweater | Photo of a knitted grey sweater folded on a table. |
| 29 | `broek` | de | trousers | Photo of a pair of folded blue jeans on a chair. |
| 30 | `sok` | de | sock | Photo of a single woolly sock. |
| 31 | `bed` | het | bed | Photo of a made single bed with white linen. |
| 32 | `kussen` | het | pillow | Photo of a single white pillow on a plain background. |
| 33 | `lamp` | de | lamp | Photo of a desk lamp switched on, neutral background. |
| 34 | `boom` | de | tree | Photo of a single tall green tree in a park. |
| 35 | `bloem` | de | flower | Photo of a single yellow tulip in a vase. |
| 36 | `regen` | de | rain | Photo of rain falling on a window pane. |
| 37 | `zon` | de | sun | Photo of bright sunlight over a flat Dutch landscape. |
| 38 | `wolk` | de | cloud | Photo of a single white cloud against a blue sky. |
| 39 | `trein` | de | train | Photo of a yellow Dutch NS train at a station platform. |
| 40 | `bus` | de | bus | Photo of a city bus on a quiet street. |

R2 upload (per noun):

```bash
wrangler r2 object put lekkertaal-images/vocab/<noun>.png \
  --file=<noun>.png --remote
```
