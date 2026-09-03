# Design System & Anti-Slop Guide — BUFATECHNO WEB GAME DEV v2

> Tujuan: cegah output generik "khas AI" (hitam polos + monospace + pulse + GAME TITLE). Setiap game WAJIB punya identitas visual unik meski prompt sederhana.

## 1. Aturan Anti-Slop (Wajib)

**Dilarang keras di deliverable final:**
- `GAME TITLE` literal, `Description of the game goes here`, `pulse 1.5s ease-in-out infinite` copy-paste di semua game
- Satu font `Courier New monospace` untuk semua genre
- Palette sama `#000/#fff/#5cf` tanpa variasi
- HUD layout sama (crosshair center + `Health: 100` di `top:10px left:10px`) untuk semua genre
- Overlay `CLICK TO PLAY` tanpa nama game/tema

**Wajib per game:**
- Generate **design tokens** unik via `:root` CSS variables sebelum nulis HTML
- Pilih **palette 3-5 warna** + **font pairing** sesuai genre (lihat tabel)
- Overlay & HUD **themed** — teks CTA sesuai lore game
- Minimal 1 procedural texture custom + 1 TSL/shader tweak berbeda tiap game

## 2. Prompt Inference Engine (Akurat dari Prompt Sederhana)

| Prompt sederhana | Inferensi otomatis (tanpa tanya) |
|---|---|
| `buat game balapan` | Genre racing third-person, low-poly stylized, track loop 1 lap win, drift `friction 0.97`, HUD speedometer angular bottom-right + minimap top-right + exhaust particles + engine loop procedural + chase cam spring-arm + lap counter |
| `game FPS` | Dark sci-fi/lab, FPS pointer-lock, hitscan + recoil 0.08 + screen shake `exp(-6*dt)`, wave 12 enemies, crosshair dot + ammo 30/90 bottom-center + armor bar, 4 sounds shoot/hit/die/win |
| `game horror` | Desaturated forest, fogExp2 0.025, vignette 0.45, flashlight cone, stamina, jumpscare audio low drone, serif font `Cormorant`, palette olive/bone/crimson |
| `voxel / minecraft` | Block 1m, chunk 16³, fbm terrain, inventory 9 slot, DDA break/place, day/night, pixel font `VT323`, palette grass/brown/sky |
| `platformer` | Momentum 0.9 friction, coyote 0.1s + buffer 0.1s, double jump puff VFX, collectible spin 1.2s, HUD coins + lives top, bright palette coral/teal |
| Tidak ada detail visual | Gunakan genre default + palette dari tabel + TSL tint unik (hue shift 15-30°) agar tidak generik |

**Prinsip:** jangan tanya ulang jika bisa inferensi 90% akurat. Langsung build dengan asumsi bertema, tulis di README "Inferred: ..." agar user paham.

## 3. Palette & Font Pairing per Genre (Pilih 1, jangan reuse sama untuk semua game)

| Genre | Palette (bg/panel/text/muted/accent/accent2) | Font Display / Body | HUD vibe |
|---|---|---|---|
| **Racing** | `#0b0e14 / rgba(22,26,34,.75) / #e8eef2 / #8ea0b0 / #00e5ff / #ff1744` | `Orbitron / Inter` | Angular speedometer, tachometer bar, minimap |
| **Sci-fi FPS** | `#070a12 / rgba(14,18,28,.7) / #e6edf3 / #7a8a9a / #55ccff / #7af0ff` | `Space Grotesk / Inter` | Crosshair dot+ring, ammo segmented, health neon |
| **Horror** | `#0e1010 / rgba(18,20,18,.72) / #e8e0d0 / #8a8278 / #c2b8a3 / #8b1a1a` | `Cormorant Garamond / IBM Plex Sans` | Stamina vignette, flashlight HUD subtle, grain |
| **Fantasy RPG** | `#12100e / rgba(28,22,18,.7) / #f2e8d5 / #a89a85 / #ffb700 / #7a5c2e` | `Cinzel / Lora` | Ornate border, mana orb, quest log parchment |
| **Voxel** | `#87ceeb bg / #3a6f2a / #c2a87e / #5c4a2a / #55ccff / #ffd166` | `VT323 / Inter` | Blocky 9-slot hotbar, pixel icons |
| **Platformer Bright** | `#1a1f2e / rgba(255,255,255,.08) / #fff / #b8c0d0 / #ff6b6b / #4ecdc4` | `Fredoka / Inter` | Bouncy coins, lives hearts, progress dots |

**Cara generate token:**
```css
:root{
  --bg:#070a12; --panel:rgba(14,18,28,.72); --text:#e6edf3; --muted:#7a8a9a;
  --accent:#55ccff; --accent-2:#7af0ff; --danger:#ff4d6d; --radius:14px;
  --font-display:"Space Grotesk", system-ui, sans-serif;
  --font-body:"Inter", system-ui, sans-serif;
}
```

## 4. HUD & Overlay Themed (Jangan Copy Template Mentah)

**Overlay CTA harus lore-aware:**
- Racing: `START ENGINE — PRESS SPACE`
- Horror: `LIGHT THE TORCH — CLICK TO ENTER THE WOODS`
- FPS: `ARM UP — CLICK TO DEPLOY`
- Voxel: `ENTER WORLD — CLICK TO GENERATE TERRAIN`

**HUD layout per genre:**
- Racing: bottom-right speed `KM/H` + progress bar top, minimap top-right
- FPS: crosshair center + ammo bottom-center + health left + wave top
- Platformer: top-left coins `×12` + top-right timer + lives hearts center-top
- Horror: minimal — vignette + stamina bar bottom (thin) + flashlight icon

**AI checklist sebelum ship:** `grep -i "GAME TITLE" index.html` harus 0 hasil; font bukan hanya monospace; palette beda dari starter `#0a0e13`.

## 5. Anti-Slop Procedural Detail

Setiap game wajib minimal:
- 1 canvas texture custom (bukan flat `#3a6f2a` — beri noise, grain, crack)
- 1 TSL tweak: `colorNode = texture(map).mul( detail.mul(0.5).add(0.5) )` atau hue shift `uv().mul(3).fract()`
- Post bloom/vignette tuned per palette (racing bloom 0.6, horror vignette 0.45 + grain)

## 6. Contoh Token Generation dari Prompt Sederhana

Prompt: `buatkan game sederhana balap mobil`

AI internal monologue (jangan output ke user, langsung apply):
> Genre=racing, palette racing neon (cyan/magenta), font Orbitron/Inter, TSL car paint metalness 0.8 + emissive strip, HUD angular speedometer 0-220, CTA "START ENGINE", VFX exhaust + skid, audio engine loop + drift screech, win 3 laps.

Prompt: `game survival hutan horror`

> Genre=horror survival, palette desaturated olive/bone/crimson, font Cormorant/IBM Plex, fog 0.022 + volumetric shafts, overlay "ENTER THE WOODS", flashlight cone, stamina + heartbeat audio, HUD minimal vignette.

## 7. Validasi Akhir (Harus Centang)

- [ ] Judul unik (bukan GAME TITLE) + CTA themed
- [ ] Palette & font dari tabel di atas (bukan #000 monospace)
- [ ] HUD layout berbeda dari starter template
- [ ] 1 procedural texture + 1 TSL/shader tweak unik
- [ ] Screenshot mental beda dari game sebelumnya — tidak generik
