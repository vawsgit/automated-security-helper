---
title: App Theme Research
---

# App Theme Research: Color Coordination for ASH Workbench

Deep investigation into the current webview color scheme, with analysis and recommendations for making the green, purple, and orange/amber colors look coordinated and professional. Blue and red are considered acceptable as-is.

## 1. Current State: Complete Color Inventory

### 1.1 Severity Badges (warm alarm scale)

Used in: `SeverityBadge.tsx`, `SidebarDashboard.tsx`, `FindingList.tsx` filter bar

| Level | Tailwind Class | OKLCH (approx) | Hue | Chroma | Lightness | Verdict |
|-------|---------------|----------------|-----|--------|-----------|---------|
| CRITICAL | `bg-red-700` | oklch(0.505 0.213 27) | 27 | 0.213 | 0.505 | OK |
| HIGH | `bg-orange-600` | oklch(0.646 0.222 41) | 41 | 0.222 | 0.646 | Address |
| MEDIUM | `bg-yellow-600` | oklch(0.681 0.162 75) | 75 | 0.162 | 0.681 | OK |
| LOW | `bg-blue-600` | oklch(0.546 0.245 263) | 263 | 0.245 | 0.546 | OK |
| INFO | `bg-gray-500` | oklch(0.551 0.014 264) | 264 | 0.014 | 0.551 | OK |

### 1.2 Disposition Badges (triage action indicators)

Used in: `DispositionBadge.tsx`, `SidebarDashboard.tsx`, `FindingDetail.tsx` button group

| Action | Tailwind Class | OKLCH (approx) | Hue | Chroma | Lightness | Verdict |
|--------|---------------|----------------|-----|--------|-----------|---------|
| PENDING | `bg-gray-500` | oklch(0.551 0.014 264) | 264 | 0.014 | 0.551 | OK |
| FIX | `bg-green-600` | oklch(0.627 0.194 149) | 149 | 0.194 | 0.627 | Address |
| SUPPRESS | `bg-purple-600` | oklch(0.558 0.288 302) | 302 | 0.288 | 0.558 | Address |
| DEFER | `bg-amber-600` | oklch(0.666 0.179 58) | 58 | 0.179 | 0.666 | Address |

### 1.3 Files That Contain These Colors

Every location where green/purple/orange/amber colors appear:

| File | Line(s) | Colors Used | Context |
|------|---------|-------------|---------|
| `SeverityBadge.tsx` | 6 | `orange-600/700` | HIGH badge |
| `DispositionBadge.tsx` | 6-8 | `green-600/700`, `purple-600/700`, `amber-600/700` | FIX, SUPPRESS, DEFER badges |
| `SidebarDashboard.tsx` | 14, 22-24 | `orange-600`, `green-600`, `purple-600`, `amber-600` | Severity/disposition summary badges |
| `FindingDetail.tsx` | 16-18 | `green-600/700`, `purple-600/700`, `amber-600/700` | Disposition action buttons |
| `tasks-demo.tsx` | 45, 53 | `green-100/800/900/200` | Status "done" + priority "low" badges (sink only) |
| `alert-demo.tsx` | 41 | `amber-50/900/950/100` | Custom amber alert (sink only) |

### 1.4 How Colors Are Applied

The current approach uses **solid-fill badges** with white text for both severity and disposition:

```
bg-{color}-600 text-white hover:bg-{color}-700
```

Both badge systems use identical visual treatment -- solid saturated background + white text at the -600/-700 level. The only way to distinguish severity from disposition is reading the text label.

## 2. Problems Identified

### 2.1 Orange/Amber Collision (Critical)

HIGH severity uses `orange-600` (hue 41) and DEFER disposition uses `amber-600` (hue 58). These are only **17 degrees apart** on the OKLCH color wheel. In the context of a findings table where both `SeverityBadge` and `DispositionBadge` appear side by side (`FindingList.tsx:135-139`), a user scanning quickly may confuse a HIGH severity badge with a DEFER disposition badge.

Both are warm-toned, similarly saturated, similarly light. On many monitors and in certain VS Code themes (especially those with warm tinting), they become nearly indistinguishable.

### 2.2 Purple-600 Is Disproportionately Vivid

`purple-600` has chroma **0.288** -- the highest of any color in the palette. For comparison:

| Color | Chroma |
|-------|--------|
| purple-600 (SUPPRESS) | **0.288** |
| blue-600 (LOW) | 0.245 |
| orange-600 (HIGH) | 0.222 |
| red-700 (CRITICAL) | 0.213 |
| green-600 (FIX) | 0.194 |

SUPPRESS visually "screams" louder than CRITICAL. This inverts the intended hierarchy. A disposition badge indicating "I acknowledged this and suppressed it" should not be the most eye-catching element on screen. The purple draws the eye away from the severity indicators that actually need attention.

### 2.3 Green-600 Reads as Generic

Tailwind's `green-600` is the most default green possible. Every Bootstrap tutorial, every "success" toast, every "online" indicator uses this exact green. In a professional security tool, it reads as a placeholder rather than an intentional design choice. It doesn't convey "action taken" -- it conveys "someone used the first green they found."

### 2.4 No Chromatic Harmony in Disposition Set

The four disposition colors span unrelated segments of the color wheel:

```
gray-500 (264, achromatic) -> green-600 (149) -> purple-600 (302) -> amber-600 (58)
```

These hues have no unifying relationship. Professional color palettes typically share an undertone (all slightly warm, or all slightly cool) or sit in deliberate harmonic relationships (triadic, split-complementary, etc.). The current dispositions feel like four independent color picks rather than a designed system.

### 2.5 Color Definitions Are Duplicated Across Files

The same severity and disposition color maps are defined independently in multiple files:

| Color Map | Location 1 | Location 2 | Location 3 |
|-----------|-----------|-----------|-----------|
| Severity styles | `SeverityBadge.tsx:4-10` | `SidebarDashboard.tsx:12-18` | -- |
| Disposition styles | `DispositionBadge.tsx:4-9` | `SidebarDashboard.tsx:20-25` | `FindingDetail.tsx:14-19` |

Each copy uses slightly different class strings (some include `hover:`, some don't; some are badge styles, some are button styles) but they all encode the same color-to-semantic mapping. Changing a color requires updating 2-3 files and hoping none are missed. This is the root cause of future drift -- a new contributor adjusting a shade in `DispositionBadge.tsx` has no signal that `SidebarDashboard.tsx` and `FindingDetail.tsx` need matching updates.

### 2.6 No Visual Distinction Between Badge Systems

Both severity and disposition badges use the same visual language: solid saturated background + white text. When a user sees two badges in a table row, there's no instant visual cue that one represents "how bad is it" (severity) and the other represents "what did I decide" (disposition). They have to read the text labels.

Professional security tools (Snyk, GitHub Security, SonarQube) typically differentiate these concepts by using:
- **Solid/vivid** badges for severity/risk (alarm signals)
- **Tinted/outline** badges for status/action (decision indicators)

## 3. Industry Benchmarks

How professional security and DevSecOps tools handle these color systems:

### Severity Scale (Industry Consensus)

There is a near-universal convention for security severity colors:
- **Critical**: Red (deep/dark)
- **High**: Orange or red-orange
- **Medium**: Yellow or amber
- **Low**: Blue or cyan
- **Info/Note**: Gray

ASH Workbench already follows this convention. The severity scale itself is sound -- orange for HIGH is the correct semantic choice. The issue is coordination with disposition colors, not the severity hues themselves.

### Disposition / Status / Action Indicators

Professional tools consistently use **cooler, more muted tones** for user-action indicators:
- **Snyk**: Blue-toned badges for fix states, gray for ignored/deferred
- **GitHub Security**: Purple for some categories, but at lower saturation than alert colors
- **SonarQube**: Blue/teal tones for status, red/orange/yellow only for severity
- **AWS Security Hub**: Uses the severity warm scale exclusively for risk; status uses neutral gray/blue

The pattern: **severity lives on the warm spectrum, actions/status live on the cool spectrum**.

## 4. Color Theory Analysis

### 4.1 The Core Principle: Warm vs Cool Separation

The most impactful improvement is to align the two badge systems with established color psychology:

- **Severity** (alarm/warning) = **warm spectrum** -- red, orange, yellow (plus blue for LOW, gray for INFO as anchors)
- **Disposition** (deliberate user action) = **cool spectrum** -- teals, indigos, slates

This creates instant perceptual grouping. A user's eye processes "warm = urgency" and "cool = resolved/decided" without conscious effort.

### 4.2 OKLCH Harmony

The OKLCH color space (used by Tailwind v4) lets us reason about perceptual harmony precisely:

- **Lightness matching**: Colors at similar L values feel balanced when side-by-side
- **Chroma matching**: Colors at similar C values feel like they belong to the same palette
- **Hue spacing**: Colors with even hue spacing feel intentional; random hue spacing feels arbitrary

For a harmonious disposition set, we want:
- All three action colors within a similar lightness range (L 0.50-0.60 for solid fills)
- Chroma values within ~0.05 of each other
- Hues that share a cool undertone (180-280 range)

## 5. Recommendations

Three options presented in order of recommendation strength. All options are compatible with the existing ShadCN Badge component and Tailwind v4 utility classes.

### 5.1 Option A: "Cool Triage" with Tinted Badges (Recommended)

**The big idea**: Change BOTH the hues AND the badge style for dispositions. Severity badges stay solid-fill (alarm signals). Disposition badges switch to tinted/outline style (decision indicators).

This creates the strongest visual distinction between the two badge systems while making the disposition colors feel coordinated and professional.

**Disposition badges -- tinted style:**

| Action | Light Mode | Dark Mode | Semantic Rationale |
|--------|-----------|-----------|-------------------|
| PENDING | `bg-gray-100 text-gray-700` | `dark:bg-gray-800/40 dark:text-gray-300` | No decision yet -- neutral |
| FIX | `bg-teal-100 text-teal-800` | `dark:bg-teal-900/40 dark:text-teal-300` | Action taken, positive -- cool green |
| SUPPRESS | `bg-indigo-100 text-indigo-800` | `dark:bg-indigo-900/40 dark:text-indigo-300` | Filed away, acknowledged -- deep blue-purple |
| DEFER | `bg-slate-200 text-slate-800` | `dark:bg-slate-700/40 dark:text-slate-300` | Paused, waiting -- neutral cool |

**HIGH severity -- minor refinement:**

| Level | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| HIGH | `bg-orange-600` | `bg-orange-700` | Slightly deeper, more authoritative, better contrast ratio with white text |

**Why this works:**
- **Instant visual separation**: Solid severity badges pop as alarms; tinted disposition badges recede as contextual metadata
- **Cool-tone harmony**: Teal (hue ~185), indigo (hue ~277), and slate (hue ~257) all share cool undertones
- **No collisions**: DEFER as cool slate can never be confused with warm orange HIGH
- **Professional precedent**: Matches the pattern used by Snyk, GitHub Security, and other enterprise security tools
- **Already proven in codebase**: The `tasks-demo.tsx` already uses this exact tinted pattern for status badges (`bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`)

**Perceptual balance (dark mode values):**
- teal-900/40 + teal-300: subtle blue-green tint
- indigo-900/40 + indigo-300: subtle blue-purple tint
- slate-700/40 + slate-300: subtle cool-gray tint
- All three at similar visual weight; none dominates

**Full class strings for `DispositionBadge.tsx`:**
```typescript
const dispositionStyles: Record<Disposition, string> = {
  PENDING: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800/40 dark:text-gray-300 dark:hover:bg-gray-700/40',
  FIX: 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:hover:bg-teal-800/40',
  SUPPRESS: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-800/40',
  DEFER: 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700/40 dark:text-slate-300 dark:hover:bg-slate-600/40',
};
```

**Full class strings for `FindingDetail.tsx` disposition buttons:**
```typescript
const dispositionButtonStyles: Record<Disposition, string> = {
  PENDING: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800/40 dark:text-gray-300',
  FIX: 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-300',
  SUPPRESS: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300',
  DEFER: 'bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700/40 dark:text-slate-300',
};
```

Note: The `ring-2 ring-offset-1` active-state pattern in `FindingDetail.tsx:60-61` continues to work with these colors. The ring draws on `--vscode-focusBorder` regardless of badge fill color.

---

### 5.2 Option B: "Cool Triage" with Solid Badges

Same hue shift as Option A, but keeping the current solid-fill badge style. Choose this if you prefer the visual weight of solid badges for dispositions.

**Disposition badges -- solid style:**

| Action | Classes | Hue | Chroma | Lightness |
|--------|---------|-----|--------|-----------|
| PENDING | `bg-gray-500 text-white hover:bg-gray-600` | 264 | 0.014 | 0.551 |
| FIX | `bg-teal-600 text-white hover:bg-teal-700` | 185 | 0.118 | 0.600 |
| SUPPRESS | `bg-indigo-600 text-white hover:bg-indigo-700` | 277 | 0.262 | 0.511 |
| DEFER | `bg-slate-500 text-white hover:bg-slate-600` | 257 | 0.046 | 0.554 |

**HIGH severity**: Same as Option A -- `bg-orange-700 text-white hover:bg-orange-800`

**Tradeoff vs Option A:**
- Simpler implementation (no light/dark mode variants for badges)
- But: loses the visual distinction between severity and disposition badge systems
- Indigo-600 still has notably higher chroma (0.262) than teal-600 (0.118), so SUPPRESS still pops more than FIX. This is less severe than purple-600 (0.288) but not fully resolved.

---

### 5.3 Option C: "Refined Current" (Conservative)

Minimal change to the current hues. Keep the same green/purple/orange family but shift to cooler, deeper variants that feel more intentional.

**Disposition badges:**

| Action | Current | Proposed | Change |
|--------|---------|----------|--------|
| PENDING | `bg-gray-500` | `bg-gray-500` | None |
| FIX | `bg-green-600` | `bg-emerald-600` | Cooler green (hue 149 -> 163), lower chroma (0.194 -> 0.145) |
| SUPPRESS | `bg-purple-600` | `bg-violet-600` | Slightly warmer purple (hue 302 -> 293), similar chroma |
| DEFER | `bg-amber-600` | `bg-sky-600` | Complete hue shift (hue 58 -> 242), resolves orange collision |

**HIGH severity**: `bg-orange-700` (deeper orange)

**Tradeoff vs Options A/B:**
- Smallest visual disruption from current design
- FIX (emerald) and SUPPRESS (violet) still have a large chroma gap (0.145 vs 0.281)
- DEFER as sky-600 is a good fix for the collision, but sky sits somewhat isolated from emerald and violet
- Does not create the warm/cool separation between badge systems

## 6. Side-by-Side Comparison

### Severity Row (all three options are the same)

```
CRITICAL  [bg-red-700]    -- unchanged
HIGH      [bg-orange-700] -- darkened one step
MEDIUM    [bg-yellow-600] -- unchanged
LOW       [bg-blue-600]   -- unchanged
INFO      [bg-gray-500]   -- unchanged
```

### Disposition Row

```
Current:
  PENDING [gray-500 solid]  FIX [green-600 solid]  SUPPRESS [purple-600 solid]  DEFER [amber-600 solid]

Option A (recommended):
  PENDING [gray tinted]     FIX [teal tinted]      SUPPRESS [indigo tinted]     DEFER [slate tinted]

Option B:
  PENDING [gray-500 solid]  FIX [teal-600 solid]   SUPPRESS [indigo-600 solid]  DEFER [slate-500 solid]

Option C:
  PENDING [gray-500 solid]  FIX [emerald-600 solid] SUPPRESS [violet-600 solid] DEFER [sky-600 solid]
```

### Visual Harmony Scores (subjective assessment)

| Criterion | Current | Option A | Option B | Option C |
|-----------|---------|----------|----------|----------|
| Disposition internal harmony | Poor -- random hues | Excellent -- cool family | Good -- cool family | Fair -- mixed |
| Severity/disposition distinction | None -- same style | Excellent -- different styles | Poor -- same style | None -- same style |
| Orange/amber collision | Yes | Resolved | Resolved | Resolved |
| Chroma balance | Poor (purple dominates) | Good (tinted normalizes) | Fair (indigo still higher) | Fair (violet still higher) |
| Professional feel | Generic | Enterprise-grade | Good | Adequate |
| Implementation complexity | Baseline | Moderate (light/dark variants) | Simple (swap classes) | Simple (swap classes) |

## 7. Additional Considerations

### 7.1 The Tasks Demo (Sink)

`tasks-demo.tsx:42-54` uses a separate color system for status/priority with tinted badges. If Option A is chosen, the tasks demo pattern **already aligns** -- the production disposition badges would use the same visual language as the demo, creating consistency across the Kitchen Sink.

### 7.2 Alert Demo (Sink)

`alert-demo.tsx:41` has a custom amber alert. This is demo-only and unaffected by disposition color changes.

### 7.3 Dashboard Triage Progress Bar

`app-mock-research.md:245-246` specifies a future triage progress bar segmented by disposition color: "Green (FIX) + Purple (SUPPRESS) + Amber (DEFER) + Gray (PENDING)." If Option A is adopted, this becomes: "Teal (FIX) + Indigo (SUPPRESS) + Slate (DEFER) + Gray (PENDING)" -- all cool tones, which will create a visually cohesive and calm progress visualization.

### 7.4 VS Code Theme Compatibility

The tinted badge approach (Option A) works well across VS Code themes because:
- Light mode: `bg-teal-100` etc. are pale enough to sit on any light background
- Dark mode: The `/40` opacity values (`bg-teal-900/40`) create subtle tints that layer naturally on any dark editor background
- High contrast: The text colors (teal-800 light / teal-300 dark) have sufficient contrast ratios

The solid badge approach (Options B/C) is inherently theme-agnostic since the badges bring their own full background+foreground colors.

### 7.5 Border Consideration for Tinted Badges

Tinted badges may benefit from a subtle border to maintain definition against varying backgrounds. The Badge component already includes `border` in its base class (`badge.tsx:7`). For Option A, adding a matching tinted border would reinforce definition:

```
border-teal-200 dark:border-teal-800  (for FIX)
border-indigo-200 dark:border-indigo-800  (for SUPPRESS)
border-slate-300 dark:border-slate-700  (for DEFER)
```

This is optional -- the default `border-transparent` from `badgeVariants` works if the tint alone provides enough contrast.

## 8. Key Takeaways

1. **The orange/amber collision is the most urgent fix.** Regardless of which option is chosen, DEFER must move away from amber/orange to avoid confusion with HIGH severity.

2. **The strongest improvement is visual separation between badge systems.** Option A's tinted dispositions vs solid severity badges gives users an instant, subconscious ability to distinguish "how bad" from "what to do."

3. **Cool-tone dispositions are the industry-standard approach.** Security tools consistently use warm tones for alarm/risk and cool tones for status/action. Aligning with this convention makes the app immediately feel professional to anyone who has used Snyk, SonarQube, GitHub Security, or AWS Security Hub.

4. **Purple-600's excessive vividness should be addressed.** At chroma 0.288 it's the loudest color in the palette. Any option that replaces it with indigo-600 (0.262) or tinted indigo-100/800 (much lower perceived saturation) is an improvement.

5. **The implementation surface is small.** Only 6 files need color class changes, and the core logic is in just 3 files: `DispositionBadge.tsx`, `SidebarDashboard.tsx`, and `FindingDetail.tsx`. The severity badge changes are confined to `SeverityBadge.tsx` and `SidebarDashboard.tsx`.

6. **Colors must be centralized before changing.** The current duplication across 3 files means any color change must be applied 2-3 times. Extracting to a single shared module is a prerequisite to the color migration, not a follow-up.

## 9. Centralization: Single Source of Truth

### 9.1 The Problem

Severity and disposition color maps are defined independently in 5 locations across 4 files (see Section 2.5). Each copy encodes the same semantic mapping (CRITICAL = red, FIX = green, etc.) but with slight class-string variations for context (badge vs button, with/without hover states).

### 9.2 Recommended Approach: Shared Theme Module

Create `src/lib/theme-colors.ts` as the single source of truth for all semantic color mappings.

**Structure:**

```typescript
// src/lib/theme-colors.ts

import type { Severity, Disposition } from '@/types/types';

// --- Severity (solid-fill alarm badges) ---

export const severityColor: Record<Severity, { base: string; hover: string }> = {
  CRITICAL: { base: 'bg-red-700 text-white',    hover: 'hover:bg-red-800' },
  HIGH:     { base: 'bg-orange-700 text-white',  hover: 'hover:bg-orange-800' },
  MEDIUM:   { base: 'bg-yellow-600 text-white',  hover: 'hover:bg-yellow-700' },
  LOW:      { base: 'bg-blue-600 text-white',    hover: 'hover:bg-blue-700' },
  INFO:     { base: 'bg-gray-500 text-white',    hover: 'hover:bg-gray-600' },
};

// --- Disposition (tinted cool-tone badges) ---

export const dispositionColor: Record<Disposition, {
  tinted: string;   // default state (badges, inactive buttons)
  solid: string;    // active/selected state (FindingDetail buttons)
  hover: string;    // hover for tinted state
}> = {
  PENDING:  {
    tinted: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
    solid:  'bg-gray-500 text-white',
    hover:  'hover:bg-gray-200 dark:hover:bg-gray-700/40',
  },
  FIX:      {
    tinted: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    solid:  'bg-teal-600 text-white',
    hover:  'hover:bg-teal-200 dark:hover:bg-teal-800/40',
  },
  SUPPRESS: {
    tinted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    solid:  'bg-indigo-600 text-white',
    hover:  'hover:bg-indigo-200 dark:hover:bg-indigo-800/40',
  },
  DEFER:    {
    tinted: 'bg-slate-200 text-slate-800 dark:bg-slate-700/40 dark:text-slate-300',
    solid:  'bg-slate-500 text-white',
    hover:  'hover:bg-slate-300 dark:hover:bg-slate-600/40',
  },
};
```

### 9.3 How Components Consume It

Each component imports from `theme-colors.ts` and picks the fields it needs:

**`SeverityBadge.tsx`** -- uses `severityColor[severity].base` + `severityColor[severity].hover`

**`DispositionBadge.tsx`** -- uses `dispositionColor[disposition].tinted` + `dispositionColor[disposition].hover`

**`SidebarDashboard.tsx`** -- uses `severityColor[s].base` for severity summary badges and `dispositionColor[d].tinted` for triage summary badges (no hover needed in summary context)

**`FindingDetail.tsx`** -- uses the filled-for-active / tinted-for-inactive pattern:
- Active button: `dispositionColor[d].solid`
- Inactive button: `dispositionColor[d].tinted` + `dispositionColor[d].hover`

**`FindingList.tsx` filter chips** -- uses `dispositionColor[d].tinted` for active filters (integrated during mock app build)

### 9.4 Why This Shape

- **`base` + `hover` (severity)**: Severity badges are simple -- one solid style, optionally hoverable. Splitting base from hover lets summary badges skip the hover class.
- **`tinted` + `solid` + `hover` (disposition)**: Disposition has two visual states (tinted default, solid active) driven by the resolved question on active-state interaction (Section 9, Q2). The `hover` applies to the tinted state only.
- **No `cn()` gymnastics**: Components do simple string concatenation (`${severityColor[s].base} ${severityColor[s].hover}`), not conditional merging. The module exports complete class strings, not fragments that need assembly.

### 9.5 Future-Proofing

When the mock app adds new color-bearing components (TriageProgressBar, SeverityChart, batch action buttons), they import from the same module. The color palette is defined once, consumed everywhere, and changed in one place.

## 10. Resolved Questions

1. **Should the FindingList filter bar badges match the new disposition style?** Yes -- the filter chips in `FindingList.tsx:82-92` should adopt tinted disposition colors to match the new badge style. This will be integrated during the mock application build rather than as a standalone change, since the FindingList is being rebuilt as part of the mock app implementation.

2. **How does the active-state ring interact with tinted badges?** Use a **filled-for-active, tinted-for-inactive** pattern. The selected disposition button in `FindingDetail.tsx` gets the solid teal/indigo/slate fill (e.g., `bg-teal-600 text-white`) while unselected buttons use the tinted style (e.g., `bg-teal-100 text-teal-800`). This replaces the current `ring-2 ring-offset-1` approach with a more intuitive filled/unfilled toggle that works naturally with tinted badges.

3. **HIGH severity shifts to orange-700.** The deeper shade provides better WCAG contrast with white text and a more authoritative feel. Since the orange/amber collision is already resolved by moving DEFER to slate, this is a refinement for polish rather than a collision fix.

## 10. Recommended Implementation Plan

### Phase 1: Centralize -- Extract shared theme module

1. **Create `src/lib/theme-colors.ts`** -- Define the canonical `severityColor` and `dispositionColor` maps with Option A color values (see Section 9.2)
2. **Refactor `SeverityBadge.tsx`** -- Remove local `severityStyles` map, import from `theme-colors.ts`
3. **Refactor `DispositionBadge.tsx`** -- Remove local `dispositionStyles` map, import from `theme-colors.ts`
4. **Refactor `SidebarDashboard.tsx`** -- Remove local `severityColors` and `dispositionColors` maps, import from `theme-colors.ts`
5. **Refactor `FindingDetail.tsx`** -- Remove local `dispositionButtonStyles` map, import from `theme-colors.ts`, wire up the filled-for-active / tinted-for-inactive pattern

After this phase, all 5 duplicate color maps are deleted from their original files and replaced by imports from the single shared module. The colors themselves change as part of the extraction -- the new module is created with Option A values from day one, so centralization and color migration happen in one pass.

### Phase 2: Verify

1. **Kitchen Sink review** -- Open the SeverityBadge and DispositionBadge demos side-by-side and verify visual harmony
2. **Theme testing** -- Check all badge states in VS Code dark, light, and high-contrast themes
3. **Context testing** -- Verify badges look correct in sidebar (narrow, ~280px) and editor panel (full-width) layouts
4. **Update app-mock-research.md Section 7.1** -- Revise the color table to reflect the new palette
