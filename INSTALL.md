# Skill Installation Guide — BUFATECHNO WEB GAME DEV v2.0.1

> **PRIMARY SUPPORT: ZCode & Claude.** Guide ini dioptimalkan untuk kedua platform tersebut. Platform lain (Cursor, OpenCode, dll) ada di Appendix akhir.

This skill tested 2026 stack: `three@0.175.0`, `babylon@8.15.0`, `vite@7` (`baseline-widely-available`), Node `>=20.19.0`.

## Requirements

- **Node** `>=20.19.0` (Vite 7 drops Node 18, see `package.json:engines`). Check `node -v`.
- Modern browser (Chrome 107+, Edge 107+, Firefox 104+, Safari 16+ — Vite baseline).
- No `npm install` needed for skill itself — AI reads `SKILL.md` markdown langsung. `npm install` hanya untuk generated games (`game/package.json`).

## ZCode — PRIMARY (verified `zcode.z.ai/en/docs/skill`)

**Path resmi (sama di semua OS — `~` = home):**

| OS | Path lengkap | Contoh |
|---|---|---|
| **Linux** | `~/.zcode/skills/<name>/SKILL.md` | `/home/you/.zcode/skills/bufatechno-webgamedev/SKILL.md` |
| **macOS** | `~/.zcode/skills/<name>/SKILL.md` | `/Users/you/.zcode/skills/bufatechno-webgamedev/SKILL.md` |
| **Windows** | `%USERPROFILE%\.zcode\skills\<name>\SKILL.md` | `C:\Users\you\.zcode\skills\bufatechno-webgamedev\SKILL.md` (= `~/.zcode/skills/` di Git Bash) |

Directory name = skill name, wajib `SKILL.md` capslock. Manage via **Settings → Skills** → Search / Enable switch / Refresh.

**Install — Linux / macOS (bash/zsh):**
```bash
cp -r bufatechno-webgamedev ~/.zcode/skills/
# Settings → Skills → Refresh → aktifkan toggle bufatechno-webgamedev ✅
```

**Install — Windows (PowerShell / Git Bash):**
```powershell
# PowerShell (normal):
Copy-Item -Recurse bufatechno-webgamedev $env:USERPROFILE\.zcode\skills\
# Git Bash (sama kayak Linux):
cp -r bufatechno-webgamedev ~/.zcode/skills/
# Settings → Skills → Refresh → toggle ON
```

**Alternatif Import (tanpa cp, auto scan Claude/Codex/OpenClaw):**
```
Settings → Skills → Import → scans external dirs → pilih Symlink (live sync) atau Copy (decoupled) → Global/Project
Invoke: $bufatechno-webgamedev buat game FPS Three.js dengan skeletal animation
Slash menu: ketik /
```

Untuk distribusi tim: flat `skills/<name>/SKILL.md` via plugin marketplace (GitHub repo/git URL/local dir) — nested `skills/group/name` tidak terbaca. Via `git` (semua OS):
```bash
git clone https://github.com/bufatechno/bufatechno-webgamedev.git ~/.zcode/skills/bufatechno-webgamedev
# Windows Git Bash: sama; PowerShell: git clone https://github.com/bufatechno/bufatechno-webgamedev.git $env:USERPROFILE\.zcode\skills\bufatechno-webgamedev
# Settings → Skills → Refresh
```

## Claude Desktop & Claude Code (CLI) — PRIMARY (verified `agensi.io` + `claude.com/docs/skills`)

**Path — sama di semua OS, `~` = home:**

| OS | Personal (semua project) | Project (team) |
|---|---|---|
| **Linux** | `~/.claude/skills/<name>/SKILL.md` → `/home/you/.claude/...` | `.claude/skills/<name>/SKILL.md` (repo root) |
| **macOS** | `~/.claude/skills/<name>/SKILL.md` → `/Users/you/.claude/...` | `.claude/skills/<name>/SKILL.md` |
| **Windows** | `%USERPROFILE%\.claude\skills\<name>\SKILL.md` → `C:\Users\you\.claude\...` (= `~/.claude/` di Git Bash) | `.claude\skills\<name>\SKILL.md` |

Load order: `project → user → plugin → built-in` (first wins). Legacy `~/Library/Application Support/Claude/skills/` sekarang unified ke `~/.claude/skills/`.

**Install — Linux / macOS (bash/zsh):**
```bash
# Personal (recommended):
cp -r bufatechno-webgamedev ~/.claude/skills/
# Project (team shared, git commit):
mkdir -p .claude/skills && cp -r bufatechno-webgamedev .claude/skills/
# Verify:
ls ~/.claude/skills/bufatechno-webgamedev/SKILL.md && head -20 ~/.claude/skills/bufatechno-webgamedev/SKILL.md
# harus --- name: bufatechno-webgamedev / description (1-1024 char) / license: MIT / compatibility: zcode, claude / metadata.version: 2.0.1
# Restart → /skills harus list bufatechno-webgamedev
```

**Install — Windows (PowerShell / Git Bash):**
```powershell
# PowerShell:
Copy-Item -Recurse bufatechno-webgamedev $env:USERPROFILE\.claude\skills\
# Project:
New-Item -ItemType Directory -Force .claude\skills; Copy-Item -Recurse bufatechno-webgamedev .claude\skills\
# Verify:
dir $env:USERPROFILE\.claude\skills\bufatechno-webgamedev\SKILL.md; Get-Content $env:USERPROFILE\.claude\skills\bufatechno-webgamedev\SKILL.md -TotalCount 20
# Git Bash (sama kayak Linux):
cp -r bufatechno-webgamedev ~/.claude/skills/
```

**Alternatif curl (hanya SKILL.md, tanpa 20 references — kurang lengkap):**
```bash
mkdir -p ~/.claude/skills/bufatechno-webgamedev && curl -fsSL https://raw.githubusercontent.com/bufatechno/bufatechno-webgamedev/main/SKILL.md -o ~/.claude/skills/bufatechno-webgamedev/SKILL.md
# PowerShell: Invoke-WebRequest https://raw.githubusercontent.com/bufatechno/bufatechno-webgamedev/main/SKILL.md -OutFile $env:USERPROFILE\.claude\skills\bufatechno-webgamedev\SKILL.md
# Lebih baik full folder copy untuk 20 references
```

**Troubleshooting Claude (semua OS):** nesting `~/.claude/skills/name/another-folder/SKILL.md` → FAIL (1 level flat), YAML `--- name/description` wajib valid, skills discovered at session start → restart.

## Verification (ZCode & Claude, v2.0.1 — semua OS)

| OS | ZCode check | Claude check |
|---|---|---|
| **Linux** | `ls ~/.zcode/skills/bufatechno-webgamedev/SKILL.md && cat ~/.zcode/skills/bufatechno-webgamedev/SKILL.md \| head -5` | `ls ~/.claude/skills/bufatechno-webgamedev/SKILL.md && cat ~/.claude/skills/bufatechno-webgamedev/SKILL.md \| head -5` |
| **macOS** | Sama (`/Users/you/.zcode/...`) → `Settings → Skills` toggle ON | Sama (`/Users/you/.claude/...`) → `/skills` slash |
| **Windows** | PowerShell: `dir $env:USERPROFILE\.zcode\skills\bufatechno-webgamedev\SKILL.md` ; Git Bash: `ls ~/.zcode/...` | PowerShell: `dir $env:USERPROFILE\.claude\skills\bufatechno-webgamedev\SKILL.md` ; Git Bash: `ls ~/.claude/...` |

1. Open assistant (ZCode atau Claude Code)
2. ZCode: `Settings → Skills` harus muncul `bufatechno-webgamedev` v2.0.1 toggle ON
3. Claude: ` /skills ` slash command harus list `bufatechno-webgamedev`
4. Test trigger: ketik `$bufatechno-webgamedev` (ZCode) atau tanya `"Build a simple FPS game in Three.js with skeletal animation"` — skill auto-trigger, infer palette/HUD themed (anti-slop: tidak ada `GAME TITLE` generik)
5. Cross-OS file check:

```bash
# Linux/macOS:
ls bufatechno-webgamedev/references | wc -l  # harus 20
head -n 5 bufatechno-webgamedev/SKILL.md    # name: bufatechno-webgamedev, description, license: MIT, compatibility: zcode, claude, metadata.version: 2.0.1
# Windows PowerShell:
(dir bufatechno-webgamedev\references).Count  # harus 20
Get-Content bufatechno-webgamedev\SKILL.md -TotalCount 5
```

## Uninstallation (ZCode & Claude — semua OS)

**Linux / macOS:**
```bash
rm -rf ~/.zcode/skills/bufatechno-webgamedev             # ZCode (atau Settings → Skills → toggle OFF)
rm -rf ~/.claude/skills/bufatechno-webgamedev            # Claude personal
rm -rf .claude/skills/bufatechno-webgamedev              # Claude project (.claude di repo)
# Restart
```

**Windows (PowerShell):**
```powershell
Remove-Item -Recurse -Force $env:USERPROFILE\.zcode\skills\bufatechno-webgamedev
Remove-Item -Recurse -Force $env:USERPROFILE\.claude\skills\bufatechno-webgamedev
Remove-Item -Recurse -Force .claude\skills\bufatechno-webgamedev
# Restart; ZCode juga support UI toggle tanpa rm
```

**Windows (Git Bash):** sama kayak Linux `rm -rf ~/.zcode/...` dan `~/.claude/...`

## Updating (semua OS)

No rebuild — AI baca markdown langsung. Update via git:

**Linux / macOS:**
```bash
git -C ~/.zcode/skills/bufatechno-webgamedev pull
git -C ~/.claude/skills/bufatechno-webgamedev pull
# Atau reinstall:
rm -rf ~/.zcode/skills/bufatechno-webgamedev && cp -r bufatechno-webgamedev ~/.zcode/skills/
rm -rf ~/.claude/skills/bufatechno-webgamedev && cp -r bufatechno-webgamedev ~/.claude/skills/
```

**Windows (PowerShell):**
```powershell
git -C $env:USERPROFILE\.zcode\skills\bufatechno-webgamedev pull
git -C $env:USERPROFILE\.claude\skills\bufatechno-webgamedev pull
```

**Redistribusi zip (semua OS):**
```bash
cd /parent/directory && zip -r bufatechno-webgamedev.zip bufatechno-webgamedev/
# Windows PowerShell: Compress-Archive -Path bufatechno-webgamedev -DestinationPath bufatechno-webgamedev.zip
```

## Troubleshooting (ZCode & Claude, v2.0.1)

| Issue | Fix (ZCode / Claude) |
|---|---|
| AI doesn't trigger | Cek `description` frontmatter pushy v2 (15+ phrases: "Three.js game", "skeletal animation", "particle effect") → prompt harus mengandung salah satu. ZCode: pakai `$bufatechno-webgamedev` explicit. Claude: `/skills` cek skill ter-load. |
| AI produces shallow games | Pastikan AI baca `SKILL.md` full ~375 lines — workflow 6 fase wajib. Weak model (≤14B): paksa Quick Start 4-step + `design-system.md` sebelum HTML. |
| AI produces "TODO: implement this" | Skill forbids stubs (Anti-Patterns). Re-prompt: "remember no-stubs + Anti-Slop Protocol" |
| AI doesn't read references | Prompt manual: "Read `references/fps-game-template.md` + `references/design-system.md` and use its code" — limit 1 file/phase untuk weak model |
| Skill is too large for context | Hanya `SKILL.md` ~375 core loaded; 20 refs on-demand. Weak model: baca `threejs-complete.md §1-7` + `game-architecture.md §1` dulu. |
| Scaffold output generik (monospace/pulse) | Scaffold **STARTER — NOT SHIPPABLE**. Log `⚠️ ANTI-SLOP — ganti palette/HUD per design-system.md` sebelum Phase 6 |
| Vite build fails (Node 18) | Upgrade Node `>=20.19.0` — Vite 7 drop Node 18. `node -v` |
| Generic `GAME TITLE` masih muncul | Fail Anti-Slop — `grep GAME\ TITLE` harus 0. Regenerate per `design-system.md` palette |

---

## Appendix — Other Platforms (optional, not primary)

<details><summary><b>OpenCode</b> — verified <code>opencode.ai/docs/skills</code> (support tapi bukan primary)</summary>

OpenCode discovery 6 lokasi (`skill` tool on-demand):
- `~/.config/opencode/skills/<name>/SKILL.md` (global)
- `.opencode/skills/<name>/SKILL.md` (project)
- Also reads `~/.claude/skills/`, `.claude/skills/`, `~/.agents/skills/`, `.agents/skills/`

```bash
cp -r bufatechno-webgamedev ~/.config/opencode/skills/
mkdir -p .opencode/skills && cp -r bufatechno-webgamedev .opencode/skills/
# /skills → should list bufatechno-webgamedev
```

</details>

<details><summary><b>Cursor</b> — verified <code>cursor.com/docs/skills</code> (project-based, not primary)</summary>

- **Project**: `.cursor/skills/<name>/SKILL.md` → `Customize → Skills → Agent Decides`
- **Install**: `mkdir -p .cursor/skills/bufatechno-webgamedev && cp -r bufatechno-webgamedev/* .cursor/skills/bufatechno-webgamedev/`
- **Migrasi**: `/migrate-to-skills` (convert rules/commands)
- **Verify**: `Customize → Skills` at session start
- Legacy `~/.cursor/skills/` masih terbaca tapi prioritas project.

</details>

<details><summary><b>Custom / Other AI Assistants</b></summary>

Any markdown reader:

- `SKILL.md` — YAML `name: bufatechno-webgamedev` + `description` (822 char) + `license: MIT` + `compatibility: zcode, claude` + `metadata.version: 2.0.1` (spec agentskills.io: hanya name/description/license/compatibility/metadata/allowed-tools)
- `references/*.md` — 20 docs on-demand, `design-system.md` wajib sebelum HUD
- `assets/templates/` — starter (BUKAN final) — Anti-Slop Protocol
- `assets/pwa/` — `manifest.json` + `sw.js`
- Fallback: paste `SKILL.md` into system prompt + `references/*.md` per phase (Weak Model max 1/phase)

</details>
