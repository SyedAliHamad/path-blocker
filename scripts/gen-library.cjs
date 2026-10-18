const fs = require('node:fs');
const B = 'https://www.myinstants.com/media/sounds/';

// Every file below was loaded from the running app and its duration measured,
// so nothing here is a guessed path.
const S = {
  fahh: ['FAHHHHHHHHHHHHHH', 'fahhhhhhhhhhhhhh.mp3'],
  faaah: ['FAAAH', 'faaah.mp3'],
  vineBoom: ['Vine Boom', 'vine-boom.mp3'],
  bruh: ['BRUH', 'movie_1.mp3'],
  animeWow: ['Anime Wow', 'anime-wow-sound-effect.mp3'],
  spongebobFail: ['SpongeBob Fail', 'spongebob-fail.mp3'],
  sadViolin: ['Sad Violin', 'tf_nemesis.mp3'],
  dunDunDun: ['Dun Dun Dunnn', 'dun-dun-dun-sound-effect-brass_8nFBccR.mp3'],
  ding: ['Ding', 'ding-sound-effect_2.mp3'],
  error: ['Error', 'error_CDOxCYm.mp3'],
  metalPipe: ['Metal Pipe Clang', 'metal-pipe-clang.mp3'],
  boneCrack: ['Bone Crack', 'bone-crack.mp3'],
  sheesh: ['Sheesh', 'original-sheesh.mp3'],
  oof: ['Roblox Oof', 'roblox-death-sound_1.mp3'],
  missionFailed: ['Mission Failed', 'mission-failed-well-get-em-next-time.mp3'],
  crickets: ['Crickets', 'crickets-chirping.mp3'],
  emotionalDamage: ['Emotional Damage', 'emotional-damage-meme.mp3'],
  bonk: ['Bonk', 'bonk_BEtiM8g.mp3'],
  airhorn: ['MLG Airhorn', 'airhorn.mp3'],
  recordScratch: ['Record Scratch', 'record-scratch.mp3'],
  whyRunning: ['Why Are You Running?', 'why-are.mp3'],
  noGod: ['No God Please No', 'no-god-please-no-noooooooooo.mp3'],
  slowClap: ['Sarcastic Slow Clap', 'slow-clap_acFgE6G.mp3'],
  boing: ['Cartoon Boing', 'cartoon-boing_7vRWDlc.mp3'],
  heartbeat: ['Heartbeat', 'heartbeatloop.mp3'],
  victory: ['Victory Fanfare', 'victory-fanfare-ffvii.mp3'],
  sadTrombone: ['Sad Trombone', 'sad-trombone.mp3'],
  laughTrack: ['Laugh Track', 'comic003.mp3'],
  whoosh: ['Whoosh', 'whoosh-sfx.mp3'],
  evilLaugh: ['Evil Laugh', 'evillaugh.swf.mp3'],
};

const asset = (key) => {
  const [label, file] = S[key];
  return { id: 'starter-' + key, label, gifUrl: null, soundUrl: B + file, weight: 1 };
};
const cat = (name, keys) => ({
  id: 'starter-' + keys[0] + '-' + name.toLowerCase().replace(/\W+/g, '-'),
  name,
  enabled: true,
  weight: 1,
  assets: keys.map(asset),
});

const MAP = {
  'game-start': [null, null],
  rematch: [['Back for more', ['ding']], null],
  'first-wall': [['Here we go', ['recordScratch']], null],
  'wall-placed': [null, null],
  'detour-mild': [['Light taunt', ['bonk', 'boing']], ['Mild annoyance', ['bruh', 'oof']]],
  'detour-big': [['Taunt', ['sheesh', 'vineBoom', 'metalPipe']], ['Pain', ['oof', 'sadTrombone']]],
  'detour-brutal': [
    ['Devastating', ['emotionalDamage', 'airhorn', 'evilLaugh']],
    ['Agony', ['fahh', 'faaah', 'noGod', 'sadViolin']],
  ],
  'wall-wasted': [['Awkward', ['crickets', 'slowClap']], ['Unbothered', ['animeWow']]],
  'wall-backfired': [['Self own', ['missionFailed', 'bruh']], ['Schadenfreude', ['laughTrack']]],
  'wall-illegal': [['Nope', ['error']], null],
  'walls-exhausted': [['Empty rack', ['sadTrombone']], ['Coast is clear', ['ding']]],
  'lead-change': [['Overtake', ['sheesh']], ['Wait what', ['animeWow']]],
  comeback: [['Resurgence', ['victory', 'airhorn']], ['Collapse', ['noGod']]],
  runaway: [['Gone', ['whyRunning']], ['Chasing', ['whyRunning']]],
  'dead-heat': [['Tension', ['dunDunDun']], null],
  'one-square-away': [['Nearly', ['heartbeat']], ['Panic', ['animeWow']]],
  'jump-over': [['Hop', ['boing', 'boneCrack']], ['Trampled', ['oof']]],
  'diagonal-sidestep': [['Smooth', ['whoosh']], null],
  standoff: [['Face off', ['dunDunDun']], null],
  'clock-low': [['Ticking down', ['heartbeat']], null],
  'timed-out': [['Fumbled', ['spongebobFail']], ['Laughing', ['laughTrack']]],
  'game-won': [['Victory', ['victory']], ['Defeat', ['sadViolin']]],
  resign: [['Gave up', ['sadTrombone']], ['Sarcasm', ['slowClap']]],
};

const scenarios = {};
for (const id of Object.keys(MAP)) {
  const [actor, target] = MAP[id];
  scenarios[id] = {
    actor: actor ? [cat(actor[0], actor[1])] : [],
    target: target ? [cat(target[0], target[1])] : [],
  };
}

// Looping beds for `game-start`. Pixabay chiptune — commercial use, no
// attribution — because music plays for the whole game and is the asset most
// exposed if this ever goes public. Every URL was loaded and timed from the
// running app; lengths run 77-178s, so they loop without an obvious seam.
const MUSIC = [
  ["Chiptune bed 1", "https://cdn.pixabay.com/audio/2026/08/19/audio_cab3803f16.mp3"],
  ["Chiptune bed 2", "https://cdn.pixabay.com/audio/2026/01/05/audio_4998066f0b.mp3"],
  ["Chiptune bed 3", "https://cdn.pixabay.com/audio/2026/08/10/audio_4534975e39.mp3"],
  ["Chiptune bed 4", "https://cdn.pixabay.com/audio/2026/05/07/audio_a01a445eef.mp3"],
  ["Chiptune bed 5", "https://cdn.pixabay.com/audio/2024/05/28/audio_c45d06345a.mp3"],
  ["Chiptune bed 6", "https://cdn.pixabay.com/audio/2026/06/27/audio_ce6b5c2f4e.mp3"],
  ["Chiptune bed 7", "https://cdn.pixabay.com/audio/2026/03/21/audio_bc75e850fb.mp3"],
  ["Chiptune bed 8", "https://cdn.pixabay.com/audio/2025/03/14/audio_9c2e1a146a.mp3"],
];

const library = {
  version: 1,
  music: MUSIC.map(([label, url], i) => ({
    id: "starter-music-" + (i + 1),
    label,
    gifUrl: null,
    soundUrl: url,
    weight: 1,
  })),
  scenarios,
  settings: {
    muted: false,
    volume: 0.7,
    musicVolume: 0.35,
    maxPerGame: 60,
    cooldownMs: 600,
    perScenarioCooldownMs: 1200,
    displayMs: 2600,
    maxSoundMs: 6000,
    cinematicMs: 4200,
  },
};

fs.writeFileSync('apps/web/public/starter-library.json', JSON.stringify(library, null, 2) + '\n');

const covered = Object.values(scenarios).filter((s) => s.actor.length || s.target.length).length;
const assets = Object.values(scenarios).reduce(
  (n, s) => n + [...s.actor, ...s.target].reduce((m, c) => m + c.assets.length, 0),
  0,
);
console.log('scenarios ' + Object.keys(MAP).length + ', covered ' + covered + ', assets ' + assets);
