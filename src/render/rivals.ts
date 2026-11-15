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
    quincy: { intro: 'New blood. Let me show you the ropes.', win: 'Welcome to the league, kid.' },
    ignar: { intro: 'Big lizard. Lightning beats fire.', win: 'Smoke and sparks. Done.' },
    vesper: { intro: "Magic tricks won't save you.", win: 'Your stars went dark.' },
  },
  jetsetter: {
    rogue: { intro: 'All that brooding and no rhythm.', win: 'Lights out, moody.' },
    chris: { intro: 'Talk all you want. I came to dance.', win: 'Stick to speeches.' },
    leader: { intro: 'You bring a crew, I bring a crowd.', win: "The crowd's mine now." },
    eddnog: { intro: 'Hope that armor bends, big man.', win: 'Heavy, but off beat.' },
    malcolm: { intro: 'Relax, Captain. This is a party.', win: 'Dismissed. Next song.' },
    quincy: { intro: 'Nice cat. Shame about the fit.', win: 'Stick to the queue, rookie.' },
    ignar: { intro: 'Cool armour. Can it dance?', win: 'Too hot for the stage.' },
    vesper: { intro: 'Starlight? I bring the spotlight.', win: 'Encore cancelled, witch.' },
  },
  chris: {
    rogue: { intro: "Let's negotiate. You lose, I win.", win: 'The house always wins.' },
    jetsetter: { intro: 'Flashy. Reckless. Easy to read.', win: 'Fame fades.' },
    leader: { intro: 'Two leaders, one table.', win: 'Motion carried.' },
    eddnog: { intro: 'Strength is not strategy, my friend.', win: 'Diplomacy beats force.' },
    malcolm: { intro: 'I read your plan last week.', win: 'Outmaneuvered, Captain.' },
    quincy: { intro: 'A finance man. Let us talk terms.', win: 'Check your portfolio.' },
    ignar: { intro: 'Dragons hoard gold. So do I.', win: 'Negotiations concluded.' },
    vesper: { intro: 'Fortune telling? I prefer poker.', win: 'The house reads fate better.' },
  },
  leader: {
    rogue: { intro: 'Come down from the roof. Join us.', win: 'Nobody wins alone.' },
    jetsetter: { intro: 'You got style. I got the crew.', win: 'Family over fame.' },
    chris: { intro: 'No speeches. Just results.', win: "That's leadership." },
    eddnog: { intro: 'Let us see who carries the team.', win: 'Good fight, big bro.' },
    malcolm: { intro: 'Captain, meet the boss.', win: 'Chain of command.' },
    quincy: { intro: 'Rookie season. Make it count.', win: 'You will get there. Not today.' },
    ignar: { intro: 'Even a dragon needs a crew.', win: 'Kneel to the crown, knight.' },
    vesper: { intro: 'Read my future: I win.', win: 'Told you so.' },
  },
  eddnog: {
    rogue: { intro: 'Stand still and fight, little guy!', win: 'Caught you!' },
    jetsetter: { intro: 'Music is nice. Smash is nicer!', win: 'Mosh pit!' },
    chris: { intro: 'No talking. Smash time!', win: "Can't negotiate a hug!" },
    leader: { intro: 'Team first... but I win first!', win: 'Bear hug for the boss!' },
    malcolm: { intro: 'Your squad is small. I am big!', win: 'Tank beats squad!' },
    quincy: { intro: 'Can I pet the cat after?', win: 'Big hug! Cat too!' },
    ignar: { intro: 'Dragon? I eat dragons!', win: 'Big hug for the dragon!' },
    vesper: { intro: 'Pretty stars! Now smash time!', win: 'Sparkles everywhere!' },
  },
  malcolm: {
    rogue: { intro: "Contact. Fast mover. Pin him down.", win: 'Target neutralized.' },
    jetsetter: { intro: 'Turn the music off. Mission time.', win: 'Show is cancelled.' },
    chris: { intro: 'Talk is cheap. Cover fire is not.', win: 'No treaty for you.' },
    leader: { intro: 'With respect, sir, step aside.', win: 'Mission first, boss.' },
    eddnog: { intro: 'Heavy armor. Flank him, squad.', win: 'Even tanks go down.' },
    quincy: { intro: 'Leave the cat out of this, son.', win: 'Rank revoked.' },
    ignar: { intro: 'Hostile, armoured, on fire. Engage.', win: 'Fire contained.' },
    vesper: { intro: 'Unknown threat. Proceed carefully.', win: 'Threat neutralized. Stars and all.' },
  },
  quincy: {
    rogue: { intro: "Bet. You're cooked.", win: 'Ez. Next game.' },
    jetsetter: { intro: 'Nice drip. My cat is better dressed.', win: 'Turn the music down, I won.' },
    chris: { intro: 'I do finance too. You are overleveraged.', win: 'Good money. Better hands.' },
    leader: { intro: 'Respect, boss. Still taking the dub.', win: 'GG, boss. Run it back?' },
    eddnog: { intro: 'Big man. My cat says no.', win: "It's just a game, big man." },
    malcolm: { intro: 'Captain? I only take orders from my cat.', win: 'Mission failed. One more?' },
    ignar: { intro: 'Bro has a tail. Respect.', win: 'My cat is scarier than you.' },
    vesper: { intro: "Ok wizard, let's queue up.", win: 'GG, witch. Ez.' },
  },
  ignar: {
    rogue: { intro: 'A storm-caller. I have eaten storms.', win: 'Your lightning only fed the fire.' },
    jetsetter: { intro: 'Your music bores me, bard.', win: 'Sing of this defeat.' },
    chris: { intro: 'Words will not cool the flame.', win: 'Your treaty burns.' },
    leader: { intro: 'A king without a dragon is no king.', win: 'Your crown melts, little king.' },
    eddnog: { intro: 'At last, someone worth the fire.', win: 'You were a mountain. I am a volcano.' },
    malcolm: { intro: 'Your soldiers will scatter like ash.', win: 'Retreat, captain.' },
    quincy: { intro: 'A warrior with a familiar. Interesting.', win: 'Tell your cat I said well fought.' },
    vesper: { intro: 'Witch. Your stars will burn.', win: 'Even stars burn out.' },
  },
  vesper: {
    rogue: { intro: 'Lightning is just a falling star in a hurry.', win: 'The sky always wins.' },
    jetsetter: { intro: 'Shall we dance among the stars?', win: 'Lovely rhythm. Wrong orbit.' },
    chris: { intro: 'I have already read your cards.', win: 'The stars do not bluff.' },
    leader: { intro: 'Every crown falls eventually.', win: 'Your reign was written short.' },
    eddnog: { intro: 'Gravity has a word for big things.', win: 'Down you come, gently.' },
    malcolm: { intro: 'Your plan, captain? I saw it last night.', win: 'Mission foretold. Mission failed.' },
    quincy: { intro: 'Your cat sees me. Clever creature.', win: 'One more game? The stars say no.' },
    ignar: { intro: 'Dragon. Be careful with that temper.', win: 'Even fire needs a sky.' },
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
