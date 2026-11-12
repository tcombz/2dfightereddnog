# Tekken and Mortal Kombat: what they do well, and what After Hours took from them

Researched November 2026. Sources are listed at the end.

## Tekken

- **Heat (Tekken 8).** A blue gauge under the health bar. Heat Burst (one button pair) works mid-combo
  and leaves you ahead whether it hits or is blocked; Heat then lasts about ten seconds and gives more
  damage, chip on block and some health back. Re-pressing it spends the rest on a Heat Smash. It was
  added to push players into attacking, and it gives every round a visible turning point.
- **Walls.** A wall splat leaves the opponent slumped against the wall for extra damage. Combos are
  routed to carry them there ("wall carry"). Players enjoy wall combos, though critics warn that very
  long wall routes cut into the back-and-forth of neutral.
- **Rage (Tekken 7) to Heat Smash (Tekken 8):** a big move unlocked by low health or by Heat, so the
  losing player always has one swing left.

## Mortal Kombat

- **Fatal Blow.** Available at 30% health or less, once per match: a comeback tool with an X-ray style
  cinematic.
- **Spectacle and identity.** Brutal, readable hits, and the Kameo partner system that gives every
  character a different set of tools (reviewers call it the series' biggest new idea). Critics
  worried it could shut out casual players.

## What After Hours took (version 21)

| From | In After Hours |
| --- | --- |
| Tekken 8 Heat | **Heat**: Light + Special once a round. Heat Burst is an invulnerable shockwave that shoves them off, hit or blocked, then six seconds of +25% damage and chip on every blocked hit, with a flame aura in the fighter's colour and a draining HUD pill. The same press in Heat is **Heat Smash**, which spends it on a launching blow. Cancels from normals like a special, so it extends combos. Controllers: LT / L2 / ZL. |
| Tekken walls | **Wall bounce**: a launch carried into the stage wall bounces back off it once, with one more juggle. |
| MK Fatal Blow, Tekken Rage | **Rally super**: on a third of your health or less, the super costs half a bar (on top of Rally's faster meter). |
| MK's readable, heavy hits | **Pixel-art hit sparks** (impact burst, critical star, electric burst for the Rogue), stone debris for Eddnog, and props for every super: the Leader's crown, Chris's globe, Malcolm's dropship. |

Not taken, on purpose: gore (the game is a party game about friends), assist characters (one-on-one
with six fighters is already plenty to learn), and long cinematic combos (they take control away; ours
stay short).

## Also fixed in the same pass

- **Hitboxes match the art.** Crouching sprites were up to 33 px taller than their crouching
  hurtboxes, so punches visibly landed on a crouching head and passed through. `scripts/fit-hitboxes.py`
  now measures every fighter's art and fits hurtbox heights and each normal's reach. Every standing jab
  now hits every crouching fighter (there is a test for it).
- Balance after both changes (hard CPU vs hard CPU, 160 games each): 44-56% for every fighter.

## Sources

- [Tekken 8 Heat system explained (ONE Esports)](https://www.oneesports.gg/tekken/tekken-8-heat-system-explained/)
- [Tekken 8 Heat system explained (Dexerto)](https://dexerto.com/tekken/tekken-8-heat-system-explained-2231285)
- [Tekken 8 Heat Burst, Engager, Smash and Dash (Charlie INTEL)](https://charlieintel.com/games/tekken-8-heat-system-explained-heat-burst-engager-smash-dash-262008)
- [Tekken 8 beginner series: how to juggle combo (Hotspawn)](https://www.hotspawn.com/fgc/guide/tekken-8-beginner-series-how-to-juggle-combo)
- [Tekken 8 wall blast mechanic explained (TechBriefly)](https://techbriefly.com/2024/01/29/tekken-8-wall-blast-mechanic-explained/)
- [The single-player problem: modern fighting game combos (Gfinity)](https://www.gfinityesports.com/article/the-single-player-problem-why-modern-fighting-game-combos-have-gone-too-far)
- [What are Fatal Blows in Mortal Kombat 1? (Charlie INTEL)](https://charlieintel.com/mortal-kombat/mortal-kombat-1-fatal-blows-267642)
- [Mortal Kombat 1 review (Prima Games)](https://primagames.com/reviews/mortal-kombat-1-review-an-experience-beyond-earthrealm)
- [Why NetherRealm went with a Kameo mechanic (Game Developer)](https://www.gamedeveloper.com/design/why-netherrealm-went-with-a-kameo-mechanic-for-mortal-kombat-1)
