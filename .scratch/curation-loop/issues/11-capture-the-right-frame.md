# 11 — Capture the right frame

**What to build:** Screenshots land on the design, not on the loading screen. A preloader
screenshot is worse than no screenshot — it is a plausible-looking record of the wrong thing, and
it will sit in the grid looking fine until the collector clicks it.

Two guards, and the second is the one that actually works. Mechanically: wait for the network to
settle, nudge the scroll and return, then capture — many hero animations only resolve after some
interaction, and a fixed delay alone will fail on precisely the sites this collector likes most.
The library already contains scroll-driven references whose designs do not exist at first paint.
Visually: **look at the resulting image** and capture again if it reads as a loading state. The
agent is already looking at the screenshot to write the analysis, so this check costs nothing and
is the only reliable detector of a preloader.

Scroll-heavy or animated sites get two or three frames, so that one moment does not misrepresent
a design that unfolds. Anything that cannot be captured usefully after retrying is parked rather
than saved with a bad image — the grid's trustworthiness is worth more than one extra reference.

Verify against the scroll-driven sites already in the library, which are known-hard cases.

**Blocked by:** 09 — this refines the capture step of the drain procedure built there.

**Status:** done

- [x] Capture waits for the network to settle before shooting
- [x] Capture nudges the scroll and returns, so interaction-gated heroes resolve
- [x] The captured image is inspected, and re-captured if it shows a loading state
- [x] Scroll-heavy or animated sites produce two or three screenshots
- [x] A reference whose screenshot cannot be captured usefully is parked, not saved with a bad image
- [x] Verified against the scroll-driven references already in the library
- [x] The procedure is documented alongside the rest of the drain
