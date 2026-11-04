# DESIGN BRIEF

## WHAT THE REFERENCE DOES (reproduce the language, not the content)
- **Hero**: full-bleed photo inset in a rounded frame, with a huge high-contrast Didone serif wordmark overlapping the bottom-left of the photo, a small italic serif tagline and a tiny sans paragraph on the right, and a small "SCROLL" label.
- **Nav**: wordmark left, a small text toggle in the centre with a thin underline on the active item, a white pill button on the right, a two-line menu icon, and a 1px hairline rule under the whole bar.
- **Numbers section**: very large, thin serif numerals placed asymmetrically on the canvas (staggered, not in a grid), each with a tiny italic unit and a two-line small sans caption, lots of empty space.
- **Showcase section**: a centred all-caps serif title overlapping three panels (left, taller centre, right), a parenthesised label top-left like "(OUR PROJECTS)", pagination "(1) (2) (3)" top-right, and a short description with a pill button at the bottom.
- **Principles section**: translucent tiles over a background image, italic serif headings, numbers in parentheses, a small paragraph on the right.
- **Overall**: huge type, small quiet UI text, hairlines, rounded section frames (about 16px), generous whitespace, slow deliberate pacing.

## ADAPTATION FOR THIS PROJECT (important)
- This is an energy‑management dashboard for a simulated 10 kWp solar residence (solar + battery + grid), so data legibility comes first.
- MUCH LIGHTER than the reference: warm ivory base, ink text, a daylight (not night) hero photo. The only deep‑moss areas are: the Optimise band on the Home page, one matching band on the Cost page, and the footer. No full dark mode and no theme toggle.
- The brand wordmark is a single constant in `frontend/src/brand.ts`. Default **"HELIOS"** (placeholder; I will change it).

