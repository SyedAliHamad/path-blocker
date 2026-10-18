# Sound research — what to put where

Researched 18 Oct 2026. Things I checked myself are marked **verified**;
everything else is a secondary source and worth re-checking before you ship.

## The headline

**"FAHHHHHHHHHHHHHH" is the single most-played sound in the US on Myinstants
right now** — number one on their trending board, with two more variants
("FAAAH", "Fahhh") and a fourth ("I've Got This FAAAAAAAAAHHHHH") also in the
top 30. Your instinct about using it for a blocked path was right, and it is
the obvious `detour-brutal` / target-side sound.

**Hotlinking works (verified).** I loaded two Myinstants files straight from
the running app — `vine-boom.mp3` (1.25s) and `bruh.mp3` (5.06s) — and both
played with correct metadata. So pasting a URL into the admin panel works
today with no download, no hosting and no CORS problem. The direct file
pattern is `https://www.myinstants.com/media/sounds/<name>.mp3`; open any
sound's page and take the audio source from it.

## Read this before you pick anything

Almost every famous meme sound is a clip of someone else's copyrighted work —
a film, a show, a song, a streamer's voice. That is fine for a Discord
soundboard and it is a different matter for a public, ad-supported game, which
is what this is heading towards.

The practical risk tiers:

| Tier | What | Use it for |
|---|---|---|
| **A — safe** | Pixabay, Mixkit, Freesound (CC0 only), OpenGameArt, Sonniss GDC bundles | Anything that ships publicly |
| **B — grey** | Myinstants, Instants.meme and other soundboards | Your own testing, private games, friends-only |
| **C — don't** | Music clips, anything with a recognisable voice or song | — |

The usual advice holds: short clips are **not** automatically fair use, "under
six seconds" is not a legal rule, commercial use weighs against fair use, and
some memes carry trademark or publicity rights on top of copyright. Pure sound
effects carry far less risk than music or voices.

**What I'd actually do:** build the whole library with Tier B while you are
designing and testing — it is faster and you will learn which scenarios
deserve which energy. Before launch, swap the audio for Tier A equivalents
that hit the same beat. The admin panel makes that a URL edit per asset, not a
rebuild, which is largely the point of storing URLs rather than files.

### Tier A sources, with terms

- **[Pixabay](https://pixabay.com/sound-effects/)** — commercial use allowed,
  **no attribution required**. You may not resell the file on its own, and
  content containing trademarks or logos can't be used commercially. Taken
  from Pixabay's own licence summary, so this one is solid.
- **[Mixkit](https://mixkit.co/free-sound-effects/)** — free licence expressly
  covers video games, no attribution, no account.
- **[Freesound](https://freesound.org/)** — licence is **per sound**, not per
  site. Filter to **CC0** and you are clear; CC-BY needs credit, and CC-BY-NC
  is unusable here.
- **[OpenGameArt](https://opengameart.org/)** — made for games; check each
  entry, many ask only for credit.
- **[Sonniss GDC bundles](https://sonniss.com/gameaudiogdc)** — large
  royalty-free professional packs, no attribution. Reported to forbid AI/ML
  training use.
- **[Uppbeat](https://uppbeat.io/)** — free tier with credit, paid tier
  without.

## What is actually trending (Myinstants US, 18 Oct 2026, verified)

Pulled from their live board today, in their order:

1. **FAHHHHHHHHHHHHHH** ← the one you wanted
2. **Vine Boom** — the universal "dramatic beat" sting
3. FAAAH
4. Fart
5. **Rizz sound effect**
6. **Anime Wow**
7. Among Us role reveal
8. Du bist gut genug
9. Chicken on tree screaming
10. Apple Pay
11. **SpongeBob Fail** — the "nnngh" failure horn
12. Fahhh
13. **Bone Crack**
14. Fart Button
15. Dexter meme
16. bark&fart
17. Spiderman meme song
18. **BRUH** — deadpan disappointment
19. sussy
20. **Metal pipe clang** — the modern "comedy impact"
21. **Error SOUNDSS**
22. Michael Jackson Hee Hee
23. What a good boy
24. romanceeeeeeeeeeeeee
25. **Sad Violin** (the meme one)
26. anime ahh
27. The Undertaker Bell
28. I've Got This FAAAAAAAAAHHHHH
29. **dun dun dunnnnnnnn**
30. **ding sound effect**
31. Hub Intro Sound
32. Tuco: GET OUT
33. Weird route jingle
34. Tiki tiki boosted
35. Discord Notification
36. Meow

Bolded ones are the ones I think map cleanly onto this game.

### Also circulating in 2026

From a Top-50 TikTok roundup (secondary source, treat as a shortlist rather
than a ranking): Skeleton Banging Shield, **Emotional Damage** (and a 2026
lofi remix of it), Metal Pipe "oh no, our table… it's broken", **Roblox Oof**,
**Bonk!**, Minecraft Villager "Hrrr", **Mission Failed (GTA V)**, **Bruh Sound
Effect #2**, **Cricket Chirps**, **Clap-Clap (sarcastic applause)**, **"Why
are you running?"**, **"Sheesh!"**, **"No God Please No"**, **"F in the
chat"**, **Directed by Robert B. Weide**, **Victory Fanfare (FFVII) 8-bit**,
**Final Boss Arrival Theme**, "Hehehehe… YES", Owen Wilson "Wow", "Look at
this graph", Goofy Run, Earrape Train Horn, Coffin Dance.

## My mapping — 23 scenarios

Two columns because the library holds separate media for the player who caused
a moment and the player it happened to. **Both play** — the actor's sound
first, the target's 300ms behind it — so fill both columns; a half-filled
scenario only makes half a joke. The suggestions are a starting point; you have
the admin panel, so argue with them.

| Scenario | Actor — did it | Target — received it |
|---|---|---|
| `game-start` | looping music bed | — |
| `rematch` | short "round 2" jingle | — |
| `first-wall` | record scratch, or a single low thud | — |
| `wall-placed` | **leave empty.** Every wall gets old fast | — |
| `detour-mild` | soft bonk, wood block | mild **BRUH** |
| `detour-big` | **Sheesh!**, **Vine Boom** | **Roblox Oof**, sad trombone |
| `detour-brutal` 🔊 | **Emotional Damage**, airhorn, evil laugh | **FAHHHHHH**, **No God Please No**, **Sad Violin** |
| `wall-wasted` | **Cricket chirps**, **sarcastic clap-clap** | **Look at this graph**, unimpressed hum |
| `wall-backfired` | **Mission Failed (GTA V)**, **Bruh** | **Hehehehe… YES**, smug chuckle |
| `wall-illegal` | **Error SOUNDSS**, buzzer | — |
| `walls-exhausted` | empty-chamber click, **F in the chat** | **Ding** — the coast is clear |
| `lead-change` | **Sheesh!** | **Anime Wow** (as in: wait, what) |
| `comeback` 🔊 | **Victory-style orchestral hit**, **Final Boss Arrival** | **No God Please No** |
| `runaway` | **Why are you running?** | **Why are you running?** |
| `dead-heat` | **dun dun dunnnnnnnn** | — |
| `one-square-away` | heartbeat / tension riser | **Anime Wow**, gasp |
| `jump-over` | cartoon boing, **Bonk!** | **Oof** |
| `diagonal-sidestep` | smooth whoosh, **Bing Chilling** | — |
| `standoff` | western standoff whistle | — |
| `clock-low` | ticking clock, heartbeat | — |
| `timed-out` | **SpongeBob Fail**, **Goofy Run** | laugh track |
| `game-won` 🔊 | **Victory Fanfare (FFVII) 8-bit**, "GG" | **Sad Violin**, **Oof** |
| `resign` | sad trombone, **F in the chat** | **sarcastic clap-clap** |

🔊 = full-screen takeover in the current config; give these the best material.

### Three that matter most

If you only fill in a few, fill these: **`detour-brutal`** (the moment the
whole game is about), **`game-won`**, and **`wall-wasted`** — the last one is
the funniest because it is the game quietly telling someone they achieved
nothing, and nobody else builds it.

## Music for `game-start`

It loops for the whole game, so it has to survive repetition — pick something
flat and rhythmic rather than melodic, and keep `musicVolume` low (it defaults
to 0.35).

- **[Pixabay Music](https://pixabay.com/music/)** — commercial use, no
  attribution. Easiest legitimate option.
- **[OpenGameArt — Free Action Chiptune Music Pack](https://opengameart.org/content/free-action-chiptune-music-pack)**
  — 13 looping tracks, free for commercial use, creator asks for credit.
- **[itch.io chiptune/loop assets](https://itch.io/game-assets/tag-chiptune/tag-loop)**
  — lots of loop-ready packs; many are name-your-price, and each has its own
  licence.
- **[Looperman](https://www.looperman.com/)** — single loops rather than
  tracks, so you may need to arrange them.

## GIFs

- **Tenor (Google)** — the **developer API terms** explicitly permit
  displaying content on ad-enabled platforms, and permit charging for API
  client access; they forbid selling advertising directly through the content
  itself. Note the conflict: Tenor's *consumer website* terms (last updated
  2021) say no commercial use. Those govern the site, not the API — read the
  [API terms](https://developers.google.com/tenor/guides/api-terms) before
  relying on either.
- **Giphy** — I could not find authoritative current terms. Third-party
  write-ups say embedding is allowed commercially with Giphy attribution and
  rate limits, but that is unconfirmed. Check their API terms directly.
- Either way, the library stores plain URLs, so direct `media.tenor.com` /
  `media.giphy.com` links work in the admin panel today without an API key.

## Practical notes

- **Autoplay.** Browsers block audio until the page has been interacted with.
  Music starts on the first click of the game, which in practice is the click
  that starts it — so it works, but a player who never clicks hears nothing.
- **Length varies wildly, and it is now handled.** I measured all 31 files in
  the starter library. They run from **0.72s** (heartbeat) to **15.33s**
  (sarcastic slow clap), and the `clock ticking` file I rejected is **61.56s**
  — a loop, not a one-shot. The player now fades a reaction out when its card
  ends, so a long file is cut cleanly instead of running over the next move.
  Watch for near-identical names with very different lengths: `bruh.mp3` is
  **5.06s**, while the *trending* BRUH is `movie_1.mp3` at **0.82s**.
- **Loudness.** Meme audio is mastered far louder than game audio. The
  per-asset weight controls how often a sound plays, not how loud it is, so
  normalise the files or keep the global `volume` low.
- **Don't fill every scenario.** The player walks down the priority order
  until it finds a scenario you have media for, so a few well-chosen ones beat
  twenty mediocre ones. `wall-placed` in particular should stay empty.

## The starter library

`apps/web/public/starter-library.json` — **49 assets across 21 of the 23
scenarios**, loadable in one click from the admin panel ("Load starter
library"). Every URL in it was fetched from Myinstants and then loaded and
timed from the running app, so none of it is a guessed path.

It also ships **8 looping chiptune beds** for `game-start`, taken from Pixabay
rather than a soundboard: music plays for the entire game and is the asset most
exposed if this goes public, so it is Tier A from the start. They run 77-178s
each, one is chosen at random per game, and the bed keeps playing underneath
every reaction — nothing interrupts it. I have not listened to them, so audition
and cull.

One scenario stays deliberately empty: `wall-placed`, so that not every wall
triggers something.

Note on autoplay: arriving on a page does not count as interaction, so the
first `play()` is usually refused. The player holds the track and starts it on
the first click or keypress instead of dropping it. Reaction sounds are not
retried that way — a sting arriving three moves late is worse than silence.

It is sound only — no gifs. Paste those in yourself, since taste matters more
there than it does for a sting.

Regenerate it with `node scripts/gen-library.cjs` if you want to change the
mapping in bulk rather than through the panel.

## Sources

- [Myinstants — trending, United States](https://www.myinstants.com/en/trending/us/) (fetched 18 Oct 2026)
- [Pixabay Content Licence summary](https://pixabay.com/service/license-summary/)
- [Tenor API Terms of Service](https://developers.google.com/tenor/guides/api-terms)
- [Instants.meme — Top 50 TikTok meme sounds, 2026](https://instants.meme/blog-post/top-50-tiktok-meme-sounds-taking-over-2026/)
- [Uppbeat — popular meme sound effects](https://uppbeat.io/blog/sound-effects/meme-sound-effects)
- [Epidemic Sound — meme sound effects](https://www.epidemicsound.com/youtube/meme-sound-effects/)
- [OpenGameArt — Free Action Chiptune Music Pack](https://opengameart.org/content/free-action-chiptune-music-pack)
- [Plagiarism Today — Copyright, Memes and the Perils of Viral Content](https://www.plagiarismtoday.com/2013/05/07/copyright-memes-and-the-perils-of-viral-content/)
