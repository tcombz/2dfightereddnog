# Why 2D fighters thrived, and what After Hours takes from it

Research notes, November 2026. Sources are listed at the end; most are journalism, developer
interviews and design essays rather than formal postmortems, so claims are attributed where they
are contested.

## What made the genre take off

**1. Combos turned button mashing into a craft.** Street Fighter II (1991) let players cancel one
attack's animation into the next, so hits chained before the opponent could react. Accounts differ
on whether this started as an accident the team kept after playtesting or as a deliberate design,
but they agree it is what made SFII a must-play and gave it depth the designers had not planned.
Players discovering routes for themselves kept the game alive for years.

**2. Readable, characterful fighters.** Each SFII fighter told you who they were before they threw
a punch: silhouette, stance and colours. Character designers in the genre call silhouette the most
important element, because players read shapes at a glance in the middle of a fight. Striking
designs pull new players in faster than any mechanic.

**3. A small set of rules with deep interactions.** Attack beats throw, throw beats block, block
beats attack: a rock-paper-scissors core (Sirlin calls the mind game "yomi"). Footsies, the dance
in and out of range to make the opponent whiff and then punish, sits on top of it. Few rules,
endless reads.

**4. Responsive controls.** Characters have to react nearly as fast as the player presses.
Modern games buffer inputs for a few frames (sources range from 3 to 10 frames) so a press made a
moment early still comes out on the first possible frame. Too large a buffer feels like the game
acts on inputs you no longer wanted, so the window is small and only the latest press counts.

**5. Spectacle that rewards comebacks.** Supers freeze the game for a beat, zoom the camera, flash
the screen and often slam in a character portrait. The freeze makes the moment unmistakable and the
payoff feels earned, which is why a match-ending super makes a room cheer.

**6. Local competition and community.** Arcades put strangers shoulder to shoulder; later, EVO and
streaming did the same at scale. Street Fighter IV (2009) is widely credited with reviving the
genre, and rollback netcode (predicting inputs and correcting when they arrive) made online play
feel close to local, widening the pool of players.

**7. Accessible on-ramps without lowering the ceiling.** Training modes, move lists and simplified
control schemes (Street Fighter 6's Modern controls) let newcomers do the cool moves and focus on
decisions, while the full scheme keeps its depth.

## What After Hours does with this

| Lesson | In the game |
| --- | --- |
| Combos are the hook | Light chains, heavy-to-special cancels, special-to-super cancels, damage scaling, combo counter. Adding: juggles after launchers, an input buffer, and listed combo routes per hero. |
| Readable characters | Four fighters with distinct colours and silhouettes taken straight from the character sheets: blue lightning, black and gold, navy and burgundy, black gold and red. |
| Attack / block / throw | Hold back to block, lows and overheads, throws beat block, strikes beat throws. |
| Responsive controls | 60 Hz fixed sim, hitstop, motion leniency, press leniency for two-button moves; adding a short attack buffer. |
| Spectacle | Super freeze, camera zoom, portrait cut-in using the character sheet art, per-hero super effects that match each sheet. |
| Community | Two players on one keyboard, gamepads, shareable web link. The sim is a pure, deterministic `step()`, which is exactly what rollback netcode needs, so online versus is a realistic next step. |
| On-ramps | Training mode with a guarding dummy, move lists, How to Play pages, CPU difficulty levels. |

## Sources

- [How Street Fighter 2 Accidentally Invented Combos (GG Recon)](https://www.ggrecon.com/articles/how-street-fighter-2-accidentally-invented-combos/)
- [Street Fighter 2 secrets (GamesRadar)](https://gamesradar.com/10-weird-secrets-made-street-fighter-2-most-important-fighting-game-ever)
- [Returning to round one: the history of Street Fighter (Game Informer)](https://gameinformer.com/feature/2022/12/27/returning-to-round-one-the-history-of-street-fighter)
- [Street Fighter 2 bug and the best combos (Screen Rant)](https://screenrant.com/street-fighter-2-bug-best-combos-fighting-games/)
- [Fighting game design with Dan Fornace: the power of silhouettes (GameDev.net)](https://comic.gamedev.net/tutorials/game-design/game-design-and-theory/fighting-game-design-with-dan-fornace-the-power-of-silhouettes-r5275)
- [Designing Yomi (Sirlin)](https://www.sirlin.net/articles/designing-yomi)
- [Fighting Game Design Fundamentals (Game Wisdom)](https://game-wisdom.com/critical/fighting-game-design-fundamentals)
- [Input buffering in fighting games (Wayline)](https://www.wayline.io/blog/input-buffering-fighting-games)
- [Input Buffering, Action Canceling (Medium)](https://medium.com/@yosispring/input-buffering-action-canceling-and-also-forbidden-knowledge-47a3f8a95151)
- [Street Fighter 6's Modern controls (PC Gamer)](https://www.pcgamer.com/street-fighter-6s-modern-controls-are-the-accessibility-breakthrough-that-finally-let-me-compete-in-fighting-games)
- [The King of Fighters XIII: Super Freeze (SRK wiki)](https://srk.shib.live/w/The_King_of_Fighters_XIII/Game_Elements/Super_Freeze)
- [Super Move Portrait Attack (Tropedia)](https://tropedia.fandom.com/wiki/Super_Move_Portrait_Attack)
- [Fighting game community (Wikipedia)](https://www.wikipedia.org/wiki/Fighting_game_community)
- [Guilty Gear Strive might have changed fighting games forever (TechRaptor)](https://techraptor.net/gaming/opinions/guilty-gear-strive-changed-fighting-games-rollback-netcode)
