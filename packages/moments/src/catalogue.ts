import type { MomentId, MomentInfo } from './types';

/**
 * Every scenario, described for the person curating the media library.
 *
 * This is the single list the admin panel renders; adding a scenario means
 * adding an entry here and a rule in `detect.ts`.
 */
export const CATALOGUE: readonly MomentInfo[] = [
  {
    id: 'game-start',
    name: 'Game starts',
    description: 'The opening whistle. Usually the background music cue.',
    group: 'Opening',
    scale: 'corner',
    priority: 5,
    actorLabel: 'Both players',
    targetLabel: null,
  },
  {
    id: 'rematch',
    name: 'Rematch',
    description: 'They went again after a finished game.',
    group: 'Opening',
    scale: 'corner',
    priority: 5,
    actorLabel: 'Both players',
    targetLabel: null,
  },
  {
    id: 'first-wall',
    name: 'First wall of the game',
    description: 'The opening act of aggression.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 25,
    actorLabel: 'Played the wall',
    targetLabel: 'Received it',
  },
  {
    id: 'wall-placed',
    name: 'Any wall placed',
    description: 'Fires for every wall no sharper scenario claims. Keep this one quiet.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 10,
    actorLabel: 'Played the wall',
    targetLabel: 'Received it',
  },
  {
    id: 'detour-mild',
    name: 'Detour forced - mild',
    description: 'Added 1 or 2 squares to the opponent route.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 45,
    actorLabel: 'Blocked them',
    targetLabel: 'Got blocked',
  },
  {
    id: 'detour-big',
    name: 'Detour forced - big',
    description: 'Added 3 to 5 squares. A real setback.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 65,
    actorLabel: 'Blocked them',
    targetLabel: 'Got blocked',
  },
  {
    id: 'detour-brutal',
    name: 'Detour forced - brutal',
    description: 'Added 6 or more squares. The short route is gone and the long way round begins.',
    group: 'Wall drama',
    scale: 'takeover',
    priority: 85,
    actorLabel: 'Blocked them',
    targetLabel: 'Got blocked',
  },
  {
    id: 'wall-wasted',
    name: 'Wall did nothing',
    description: 'Spent a wall and the opponent route did not get any longer. The bruh moment.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 60,
    actorLabel: 'Wasted it',
    targetLabel: 'Unbothered',
  },
  {
    id: 'wall-backfired',
    name: 'Wall backfired',
    description: 'Their own route grew more than the opponent route did.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 70,
    actorLabel: 'Shot themselves',
    targetLabel: 'Benefited',
  },
  {
    id: 'wall-illegal',
    name: 'Tried to seal someone in',
    description: 'Attempted a wall that would have left a player with no route at all.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 28,
    actorLabel: 'Tried it',
    targetLabel: null,
  },
  {
    id: 'walls-exhausted',
    name: 'Out of walls',
    description: 'Just played their last wall. From here they can only run.',
    group: 'Wall drama',
    scale: 'corner',
    priority: 40,
    actorLabel: 'Out of walls',
    targetLabel: 'Free to run',
  },
  {
    id: 'lead-change',
    name: 'Lead change',
    description: 'The player behind in the race just went ahead.',
    group: 'Race drama',
    scale: 'corner',
    priority: 58,
    actorLabel: 'Took the lead',
    targetLabel: 'Lost the lead',
  },
  {
    id: 'comeback',
    name: 'Comeback',
    description: 'Was five or more squares behind and is now level or ahead.',
    group: 'Race drama',
    scale: 'takeover',
    priority: 90,
    actorLabel: 'Came back',
    targetLabel: 'Threw it away',
  },
  {
    id: 'runaway',
    name: 'Running away with it',
    description: 'Lead has stretched past six squares.',
    group: 'Race drama',
    scale: 'corner',
    priority: 55,
    actorLabel: 'Miles ahead',
    targetLabel: 'Miles behind',
  },
  {
    id: 'dead-heat',
    name: 'Dead heat',
    description: 'Level on distance with both players close to home.',
    group: 'Race drama',
    scale: 'corner',
    priority: 42,
    actorLabel: 'Neck and neck',
    targetLabel: null,
  },
  {
    id: 'one-square-away',
    name: 'One square from winning',
    description: 'Next move wins it unless something changes.',
    group: 'Race drama',
    scale: 'corner',
    priority: 50,
    actorLabel: 'On the brink',
    targetLabel: 'In trouble',
  },
  {
    id: 'jump-over',
    name: 'Jumped the opponent',
    description: 'Hopped straight over the other pawn.',
    group: 'Pawn moves',
    scale: 'corner',
    priority: 52,
    actorLabel: 'Jumped',
    targetLabel: 'Got jumped',
  },
  {
    id: 'diagonal-sidestep',
    name: 'Diagonal sidestep',
    description: 'The rare one: blocked behind the opponent, so they slid round the side.',
    group: 'Pawn moves',
    scale: 'corner',
    priority: 54,
    actorLabel: 'Slid round',
    targetLabel: 'Got rounded',
  },
  {
    id: 'standoff',
    name: 'Pawns face to face',
    description: 'The two pawns ended up adjacent.',
    group: 'Pawn moves',
    scale: 'corner',
    priority: 30,
    actorLabel: 'Moved in',
    targetLabel: 'Stared down',
  },
  {
    id: 'clock-low',
    name: 'Under three seconds',
    description: 'The move timer is nearly out.',
    group: 'Clock',
    scale: 'corner',
    priority: 20,
    actorLabel: 'Running out',
    targetLabel: null,
  },
  {
    id: 'timed-out',
    name: 'Ran out of time',
    description: 'The timer expired and the pawn was moved for them.',
    group: 'Clock',
    scale: 'corner',
    priority: 44,
    actorLabel: 'Timed out',
    targetLabel: 'Watched it happen',
  },
  {
    id: 'game-won',
    name: 'Game won',
    description: 'Somebody reached the far side. Winner and loser see opposite reactions.',
    group: 'Endgame',
    scale: 'takeover',
    priority: 100,
    actorLabel: 'Won',
    targetLabel: 'Lost',
  },
  {
    id: 'resign',
    name: 'Resignation',
    description: 'Somebody gave up.',
    group: 'Endgame',
    scale: 'corner',
    priority: 80,
    actorLabel: 'Resigned',
    targetLabel: 'Handed a win',
  },
];

const BY_ID = new Map<MomentId, MomentInfo>(CATALOGUE.map((info) => [info.id, info]));

export function momentInfo(id: MomentId): MomentInfo {
  const info = BY_ID.get(id);
  if (!info) throw new Error(`unknown moment: ${id}`);
  return info;
}

/** Catalogue entries bucketed by `group`, in catalogue order. */
export function catalogueByGroup(): { group: string; moments: MomentInfo[] }[] {
  const groups: { group: string; moments: MomentInfo[] }[] = [];
  for (const info of CATALOGUE) {
    const last = groups.at(-1);
    if (last && last.group === info.group) last.moments.push(info);
    else groups.push({ group: info.group, moments: [info] });
  }
  return groups;
}
