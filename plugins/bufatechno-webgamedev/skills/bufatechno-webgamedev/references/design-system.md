# Design System & Anti-Slop Guide — BUFATECHNO WEB GAME DEV v2

> Goal: prevent generic "AI-typical" output (plain black + monospace + pulse + GAME TITLE). Every game MUST have a unique visual identity even with a simple prompt.

## 1. Anti-Slop Rules (Required)

**Strictly forbidden in final deliverable:**
- Literal `GAME TITLE`, `Description of the game goes here`, `pulse 1.5s ease-in-out infinite` copy-pasted in every game
- Single font `Courier New monospace` for all genres
- Same palette `#000/#fff/#5cf` without variation
- Same HUD layout (crosshair center + `Health: 100` at `top:10px left:10px`) for all genres
- Overlay `CLICK TO PLAY` without game name/theme

**Required per game:**
- Generate unique **design tokens** via `:root` CSS variables before writing HTML
- Choose **palette of 3-5 colors** + **font pairing** per genre (see table)
- Overlay & HUD **themed** — CTA text matching game lore
- At least 1 custom procedural texture + 1 TSL/shader tweak different per game

## 2. Prompt Inference Engine (Accurate from Simple Prompts)

| Simple prompt | Automatic inference (without asking) |
|---|---|
| `create racing game` | Genre racing third-person, low-poly stylized, track loop 1 lap win, drift `friction 0.97`, HUD angular speedometer bottom-right + minimap top-right + exhaust particles + procedural engine loop + chase cam spring-arm + lap counter |
| `FPS game` | Dark sci-fi/lab, FPS pointer-lock, hitscan + recoil 0.08 + screen shake `exp(-6*dt)`, wave 12 enemies, crosshair dot + ammo 30/90 bottom-center + armor bar, 4 sounds shoot/hit/die/win |
| `horror game` | Desaturated forest, fogExp2 0.025, vignette 0.45, flashlight cone, stamina, jumpscare audio low drone, serif font `Cormorant`, palette olive/bone/crimson |
| `voxel / minecraft` | Block 1m, chunk 16³, fbm terrain, inventory 9 slots, DDA break/place, day/night, pixel font `VT323`, palette grass/brown/sky |
| `platformer` | Momentum 0.9 friction, coyote 0.1s + buffer 0.1s, double jump puff VFX, collectible spin 1.2s, HUD coins + lives top, bright palette coral/teal |
| No visual details | Use default genre + palette from table + unique TSL tint (hue shift 15-30°) to avoid generic look |

**Principle:** do not ask again if you can infer with 90% accuracy. Build directly with themed assumptions, write in README "Inferred: ..." so user understands.

## 3. Palette & Font Pairing per Genre (Choose 1, do not reuse same for all games)

| Genre | Palette (bg/panel/text/muted/accent/accent2) | Font Display / Body | HUD vibe |
|---|---|---|---|
| **Racing** | `#0b0e14 / rgba(22,26,34,.75) / #e8eef2 / #8ea0b0 / #00e5ff / #ff1744` | `Orbitron / Inter` | Angular speedometer, tachometer bar, minimap |
| **Sci-fi FPS** | `#070a12 / rgba(14,18,28,.7) / #e6edf3 / #7a8a9a / #55ccff / #7af0ff` | `Space Grotesk / Inter` | Crosshair dot+ring, ammo segmented, health neon |
| **Horror** | `#0e1010 / rgba(18,20,18,.72) / #e8e0d0 / #8a8278 / #c2b8a3 / #8b1a1a` | `Cormorant Garamond / IBM Plex Sans` | Stamina vignette, flashlight HUD subtle, grain |
| **Fantasy RPG** | `#12100e / rgba(28,22,18,.7) / #f2e8d5 / #a89a85 / #ffb700 / #7a5c2e` | `Cinzel / Lora` | Ornate border, mana orb, quest log parchment |
| **Voxel** | `#87ceeb bg / #3a6f2a / #c2a87e / #5c4a2a / #55ccff / #ffd166` | `VT323 / Inter` | Blocky 9-slot hotbar, pixel icons |
| **Platformer Bright** | `#1a1f2e / rgba(255,255,255,.08) / #fff / #b8c0d0 / #ff6b6b / #4ecdc4` | `Fredoka / Inter` | Bouncy coins, lives hearts, progress dots |

**How to generate tokens:**
```css
:root{
  --bg:#070a12; --panel:rgba(14,18,28,.72); --text:#e6edf3; --muted:#7a8a9a;
  --accent:#55ccff; --accent-2:#7af0ff; --danger:#ff4d6d; --radius:14px;
  --font-display:"Space Grotesk", system-ui, sans-serif;
  --font-body:"Inter", system-ui, sans-serif;
}
```

## 4. HUD & Overlay Themed (Do Not Copy Raw Template)

**Overlay CTA must be lore-aware:**
- Racing: `START ENGINE — PRESS SPACE`
- Horror: `LIGHT THE TORCH — CLICK TO ENTER THE WOODS`
- FPS: `ARM UP — CLICK TO DEPLOY`
- Voxel: `ENTER WORLD — CLICK TO GENERATE TERRAIN`

**HUD layout per genre:**
- Racing: bottom-right speed `KM/H` + progress bar top, minimap top-right
- FPS: crosshair center + ammo bottom-center + health left + wave top
- Platformer: top-left coins `×12` + top-right timer + lives hearts center-top
- Horror: minimal — vignette + stamina bar bottom (thin) + flashlight icon

**AI checklist before ship:** `grep -i "GAME TITLE" index.html` must return 0 results; font is not monospace only; palette differs from starter `#0a0e13`.

## 5. Anti-Slop Procedural Detail

Every game must have at minimum:
- 1 custom canvas texture (not flat `#3a6f2a` — add noise, grain, crack)
- 1 TSL tweak: `colorNode = texture(map).mul( detail.mul(0.5).add(0.5) )` or hue shift `uv().mul(3).fract()`
- Post bloom/vignette tuned per palette (racing bloom 0.6, horror vignette 0.45 + grain)

## 6. Example Token Generation from Simple Prompt

Prompt: `create a simple racing game`

AI internal monologue (do not output to user, apply directly):
> Genre=racing, palette racing neon (cyan/magenta), font Orbitron/Inter, TSL car paint metalness 0.8 + emissive strip, HUD angular speedometer 0-220, CTA "START ENGINE", VFX exhaust + skid, audio engine loop + drift screech, win 3 laps.

Prompt: `forest horror survival game`

> Genre=horror survival, palette desaturated olive/bone/crimson, font Cormorant/IBM Plex, fog 0.022 + volumetric shafts, overlay "ENTER THE WOODS", flashlight cone, stamina + heartbeat audio, HUD minimal vignette.

## 7. Final Validation (Must Check)

- [ ] Unique title (not GAME TITLE) + themed CTA
- [ ] Palette & font from table above (not #000 monospace)
- [ ] HUD layout different from starter template
- [ ] 1 procedural texture + 1 TSL/shader tweak unique
- [ ] Mental screenshot different from previous game — not generic
