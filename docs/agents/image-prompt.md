# Writing an image prompt

How to write the `imagePrompt` field of a reference. Read by the drain (`docs/agents/drain.md`,
step 3) and by anyone writing a reference by hand.

An image prompt must work in both **GPT Image** and **Nano Banana**, so it follows what their
prompting guides agree on. Sources, last read 2026-09-21:

- OpenAI: <https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide>
- Google: <https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana>

The prompt is a text-to-image prompt with no reference images. The guides' sections on editing,
multi-image input, transparent backgrounds and web-search grounding don't apply.

## Hard rules (from `CONTEXT.md`)

- Dense visual description of the reference's look.
- **No interface vocabulary.** Never mention websites, pages, layout, buttons, navigation, hero
  sections, cards or the like. Describe the visual world, not the product.

## Structure

One paragraph, in this order, so nothing is dropped and the prompt stays easy to maintain:

1. **Subject**: the main thing in frame, with concrete detail.
2. **Action or state**: what it is doing or in what condition (dissolving, mid-pour, floating).
3. **Setting**: background and surroundings.
4. **Composition and camera**: viewpoint (top-down, low-angle, eye-level), framing (close-up,
   wide, centred), lens and depth of field.
5. **Lighting and mood**: the light setup and the feeling it produces.
6. **Style and medium**: photo, 3D render, illustration, painting; film stock or grade.
7. **Colour and materials**: named colours and named surfaces.

Open with a strong verb or the medium ("A cinematic still of…", "Render…").

## Rules

- **Concrete over abstract.** Name materials and surfaces ("brushed aluminium", "matte
  ceramic", "navy tweed"), not adjectives like "sleek", "modern" or "clean".
- **Photographic terms for camera and light.** Viewpoint, lens, depth of field
  ("35mm, shallow depth of field, f/1.8"), light setup ("single hard side light", "three-point
  softbox", "golden-hour backlight"), grade or film stock ("muted teal grade", "1980s colour
  film, slight grain"). Use them for the look and composition, not to simulate exact optics.
- **Positive framing.** Say what is there ("an empty black void") rather than what isn't ("no
  colour, no clutter"). Keep exclusions to a short closing clause of things that would really
  hurt: "no text, no watermark, no logos".
- **State the medium.** Add "photorealistic" or "real photograph" only when the reference is
  photographic. For stylised work, write it like a creative brief: mood, concept, boundaries.
- **Avoid in-image text.** If the look depends on a word, put it in quotes, describe the
  typeface ("bold white sans-serif"), and ask for it verbatim, rendered once.
- **Name colours in words**, consistent with the reference's `palette` field.
- **Scale.** Where several objects appear, give their size relationship.
- **Aspect ratio** only when the composition depends on it ("16:9 wide"). Otherwise leave it to
  the generator's setting.
- **Don't overload.** Dense doesn't mean long: cut anything that doesn't change the picture.

## Example

Reference: Locomotive (black page, serif type dissolving into monospace noise).

Before (mood description, negatives, no camera or light):

> Pure black void, a single line of pale serif type dissolving into scrambled monospace glyphs
> mid-decode. Faint afterimages of half-formed letters hover at the edges, like a signal not yet
> locked. No colour, no texture beyond grain — just typography materialising out of static. Cold,
> precise, quietly ominous. Off-white ink on absolute black, minimal, hypnotic, technical.

After (follows the structure and rules above):

> A macro photograph of a single line of pale serif letters dissolving into scrambled monospace
> glyphs, caught mid-transformation, as if projected onto matte black glass. Half-formed letter
> shapes hover as faint afterimages toward the edges of frame, like a signal not yet locked.
> Flat, centred composition, shot straight-on with a 100mm macro lens and a shallow depth of
> field so the glyphs at the edges fall softly out of focus. A single cold, dim key light grazes
> the letterforms; the surrounding space is an empty, absolute black. Fine film grain, cold and
> precise, quietly ominous. Off-white ink (#F4F3EE) on true black (#000000), no text other than
> the dissolving glyphs, no watermark.

The "after" keeps the reference's character but is ordered, names its lens and light, and leans
on positive descriptions.
