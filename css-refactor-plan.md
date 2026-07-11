# CSS refactor plan — tw-style.scss
_Audit date: July 2026. Zero visual changes intended._

The old `tw-style.css` had ~20+ `!important` declarations because it had to fight the Digital Garden plugin's base theme. Post-refactor, there's only one stylesheet (`tw-style.css`) and no competing base — so almost all of those are already gone. The SCSS is in decent shape. The changes below clean up what's left.

---

## The !important (one remaining)

**Line 311 — `a.tag:hover { color: white !important }`**

Why it existed: the old DG plugin styles set `color` on links with `!important`, so `color: white` needed to match that weight to win.

Why it's no longer needed: the only competing rule is `.content a { color: $color-secondary }` at specificity `(0,1,1)`. `a.tag:hover` also sits at `(0,1,1)` but comes later in the file, so it already wins the cascade without `!important`.

Fix: increase specificity by scoping it — removes the `!important` and makes the intent explicit.

```scss
// Before
a.tag {
  &:hover {
    color: white !important;
    background-color: $color-secondary;
  }
}

// After — scope to .content so specificity (0,2,1) beats .content a (0,1,1) unambiguously
.content a.tag:hover {
  color: white;
  background-color: $color-secondary;
}
```

> Keep `a.tag` for all the non-hover properties (background, border-color, padding etc.) — only the hover rule needs to move.

---

## Dead code — old-theme overrides

These were workarounds for the Digital Garden plugin's base CSS which set borders on all `<a>` elements. Now there's no base theme, no browser default puts a border on anchors, so these do nothing.

**Line 174 — `a#logo { border: 0 }`**
Remove. Nothing adds a border to this element.

**Line 205 — `nav ul#topnav li a { border-bottom: 0 }`**
Remove. Same — old DG theme had `a { border-bottom: 1px solid... }` globally; that's gone.

---

## Dead code — duplicate property

**Lines 113 + 116 — duplicate `line-height` in the `h1–h6` block**

```scss
h1, h2, h3, h4, h5, h6 {
  line-height: 1.3;   // ← this is immediately overridden and never applies
  margin-bottom: 0;
  padding-bottom: 0;
  line-height: 1;     // ← this one wins
```

Remove `line-height: 1.3` on line 113.

---

## Dead code — unused CSS custom property

**Lines 10–12 — `--p-pink-100: #fcf4f2` in `:root`**

This was the start of a CSS variable system (Tier 1 primitives comment) that was never continued. The value is the same as `$pink-lightest` / `$color-background` but is never referenced anywhere — not in this file, not in any template. Remove it (or complete the variable migration as a separate piece of work).

---

## Dead code — unused selectors

These classes/IDs were cross-checked against all `.njk`, `.md`, and `.html` files in `/src/site/`. None are referenced.

| Selector | Lines | Action |
|---|---|---|
| `.superwide {}` | 372–383 | Delete block |
| `#recently {}` | 358–361 | Delete block |
| `.boxes {}` | 363–370 | Delete block |
| `.box` in `form, .box {}` | 428 | Remove `.box` from selector, keep `form` |

**Kept (confirmed in use):**
- `img.two-col` — used in `Revisiting ceramics.md`
- `q` element — used in multiple letters
- `input#bd-email` — used in `letters.njk`
- `form {}` — used in `letters.njk`

---

## Minor consistency fix

**Line 155 — `code { border-radius: 4px }`**

Hardcoded `4px` instead of `$border-radius` (which is also `4px`, so no visual change). Swap to the variable so a future token change propagates.

```scss
// Before
code {
  border-radius: 4px;
}

// After
code {
  border-radius: $border-radius;
}
```

---

## Optional — flagged for later (visual change risk)

**Nav layout: floats → flexbox**

The nav uses `float: left` on `a#logo` and `ul#topnav` (desktop breakpoint), with `.wrapper { clear: both }` to contain them. This is functional but an older pattern. Converting to flexbox would simplify the markup and remove the need for `clear: both`, but it carries enough layout risk to warrant visual QA before doing it.

Not recommended to do in the same pass as the above changes. Flag for a separate ticket with before/after screenshots.

---

## Summary of changes

| Change | Lines affected | Risk |
|---|---|---|
| Fix `a.tag:hover` !important | 311 | None — same visual output, higher clarity |
| Remove `border: 0` from `a#logo` | 174 | None |
| Remove `border-bottom: 0` from nav `li a` | 205 | None |
| Remove duplicate `line-height: 1.3` | 113 | None — the other value already wins |
| Remove `--p-pink-100` from `:root` | 10–12 | None |
| Delete `.superwide {}` | 372–383 | None — class not used |
| Delete `#recently {}` | 358–361 | None — ID not used |
| Delete `.boxes {}` | 363–370 | None — class not used |
| Remove `.box` from `form, .box` selector | 428 | None — class not used |
| Use `$border-radius` in `code {}` | 155 | None — same computed value |

10 changes. 0 visual impact. 1 `!important` eliminated.
