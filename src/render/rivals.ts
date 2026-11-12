// Rival lines: what each fighter says to each opponent, before the bell and after a win. Falls back
// to the fighter's own quotes for a mirror match or a missing pair.
import { HEROES } from '../sim';
import { heroInfo } from './heroInfo';

type Lines = { intro: string; win: string };

/** RIVALS[speaker][opponent]. */
const RIVALS: Record<string, Record<string, Lines>> = {
  rogue: {
    jetsetter: { intro: 'Nice jacket. Shame about the footwork.', win: 'Skip the encore.' },
    chris: { intro: 'No deals tonight, Diplomat.', win: 'Should have folded.' },
    leader: { intro: "Your crew can't follow me up here.", win: 'Lead from the floor.' },
    eddnog: { intro: "Big guy. Can't hit what you can't catch.", win: 'Too slow, Tank.' },
    malcolm: { intro: 'Your plan dies the second I blink.', win: 'Briefing over.' },
  },
  jetsetter: {
    rogue: { intro: 'All that brooding and no rhythm.', win: 'Lights out, moody.' },
    chris: { intro: 'Talk all you want. I came to dance.', win: 'Stick to speeches.' },
    leader: { intro: 'You bring a crew, I bring a crowd.', win: "The crowd's mine now." },
    eddnog: { intro: 'Hope that armor bends, big man.', win: 'Heavy, but off beat.' },
    malcolm: { intro: 'Relax, Captain. This is a party.', win: 'Dismissed. Next song.' },
  },
  chris: {
    rogue: { intro: "Let's negotiate. You lose, I win.", win: 'The house always wins.' },
    jetsetter: { intro: 'Flashy. Reckless. Easy to read.', win: 'Fame fades.' },
    leader: { intro: 'Two leaders, one table.', win: 'Motion carried.' },
    eddnog: { intro: 'Strength is not strategy, my friend.', win: 'Diplomacy beats force.' },
    malcolm: { intro: 'I read your plan last week.', win: 'Outmaneuvered, Captain.' },
  },
  leader: {
    rogue: { intro: 'Come down from the roof. Join us.', win: 'Nobody wins alone.' },
    jetsetter: { intro: 'You got style. I got the crew.', win: 'Family over fame.' },
    chris: { intro: 'No speeches. Just results.', win: "That's leadership." },
    eddnog: { intro: 'Let us see who carries the team.', win: 'Good fight, big bro.' },
    malcolm: { intro: 'Captain, meet the boss.', win: 'Chain of command.' },
  },
  eddnog: {
    rogue: { intro: 'Stand still and fight, little guy!', win: 'Caught you!' },
    jetsetter: { intro: 'Music is nice. Smash is nicer!', win: 'Mosh pit!' },
    chris: { intro: 'No talking. Smash time!', win: "Can't negotiate a hug!" },
    leader: { intro: 'Team first... but I win first!', win: 'Bear hug for the boss!' },
    malcolm: { intro: 'Your squad is small. I am big!', win: 'Tank beats squad!' },
  },
  malcolm: {
    rogue: { intro: "Contact. Fast mover. Pin him down.", win: 'Target neutralized.' },
    jetsetter: { intro: 'Turn the music off. Mission time.', win: 'Show is cancelled.' },
    chris: { intro: 'Talk is cheap. Cover fire is not.', win: 'No treaty for you.' },
    leader: { intro: 'With respect, sir, step aside.', win: 'Mission first, boss.' },
    eddnog: { intro: 'Heavy armor. Flank him, squad.', win: 'Even tanks go down.' },
  },
};

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

/** The line `speaker` says to `opponent` before the fight. */
export function introLine(speaker: number, opponent: number): string {
  const a = HEROES[speaker].id;
  const b = HEROES[opponent].id;
  return RIVALS[a]?.[b]?.intro ?? pick(heroInfo(a).quotes);
}

/** The line `winner` says to `loser` on the results screen (half the time, a fighter's own quote). */
export function winLine(winner: number, loser: number): string {
  const a = HEROES[winner].id;
  const b = HEROES[loser].id;
  const r = RIVALS[a]?.[b]?.win;
  return r && Math.random() < 0.65 ? r : pick(heroInfo(a).quotes);
}
