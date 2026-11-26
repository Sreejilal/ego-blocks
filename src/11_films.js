/* =====================================================================
   STORY_FILMS: what happens on screen in every STORY scene (Movie, 11_movie.js). Keyed by event id, then 'intro' (before
   the match) or 'outro' (after the first win). Each film:
     set:   where everyone starts: KEY: [x, z, facing] (facing: an angle, 0 = towards the +z goal, or someone's key);
            ball: 'KEY' (at their feet) or [x, z]
     open:  the opening shot, before any words: { t: seconds, cam / cams, do: [actions] }
     lines: one entry per line of the event's intro / outro, in order: { cam / cams, do, hold (seconds to wait at least) }
            a missing entry gets a good shot by itself (over the shoulder or a close-up of whoever talks)
     end:   the closing shot after the last line
   Shots: ['close', who], ['ots', talker, listener], ['two', a, b], ['low', who], ['orbit', who, r, height, speed],
   ['track' | 'follow' | 'lead', who], ['wide', x, z, r, height, speed], ['fly', [from], [to], who | [at], seconds],
   ['goal', +1 | -1], ['group', [keys]], ['eyes', who] (the eye close-up in a thin strip), ['face', who] (the whole head, straight on), ['zoom', who] (a dolly zoom),
   ['ballcam'] (behind the flying ball). cams: [[seconds, shot], ...] cuts during the beat.
   Anime moments (see 11_movie.js): [who, 'glare'], [who, 'charge', seconds], [who, 'shoot', goal, x, y, 'power'],
   ['*', 'impact'], ['*', 'slow', speed, seconds], ['*', 'lines', 'focus' | 'burst' | 'rush', seconds], ['*', 'dark', who | false],
   ['*', 'word', text, colour], ['*', 'panels', 'cols3' | 'rows3' | 'rows2' | 'band', [shots], seconds, text, colour].
   The +z goal is at z = 55 (F.L); the pitch is 70 wide (x from -35 to 35).
   ===================================================================== */
const STORY_FILMS = {
  bp1: {
    intro: {
      set: { YOU: [0, 41, 0], COACH: [9, 34, 'YOU'], RIVAL: [-12, 34, 'YOU'], R1: [-13.5, 32.5, 'YOU'], ball: 'YOU' },
      open: { t: 7.6, cams: [[0, ['fly', [22, 16, 20], [5, 1.9, 35], 'YOU', 2.6]], [2.65, ['eyes', 'YOU']], [3.25, ['low', 'YOU', 0.9, 3.4]], [4.1, ['ballcam']], [4.75, ['goal', 1]]], do: [['YOU', 'juggle', 2.6], ['YOU', 'glare'], ['YOU', 'face', -2.6, 55], ['YOU', 'wait', 0.55], ['YOU', 'charge', 0.6], ['YOU', 'shoot', 1, -2.6, 1.6, 'power'], ['*', 'at', 2.65, 'lines', 'focus', 0.6], ['COACH', 'wait', 5.2], ['COACH', 'emote', 'clap', 1.6]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'walk', 3.4, 38.6]], hold: 3.2 },
        { cam: ['low', 'YOU'], do: [['YOU', 'face', 26, 52], ['YOU', 'emote', 'aim', 1.6]] },
        { cam: ['ots', 'COACH', 'YOU'], do: [['COACH', 'emote', 'fold', 0]] },
        { cams: [[0, ['track', 'RIVAL']], [2.3, ['close', 'RIVAL']]], do: [['RIVAL', 'jog', -3.6, 38.2], ['RIVAL', 'emote', 'laugh', 0], ['R1', 'jog', -5.4, 36.4], ['R1', 'emote', 'laugh', 0]], hold: 3.4 },
      ],
      end: { t: 3.9, cam: ['two', 'YOU', 'RIVAL'], do: [['YOU', 'face', 'RIVAL'], ['YOU', 'emote', 'stance', 0], ['RIVAL', 'emote', 'fold', 0], ['*', 'at', 1.0, 'panels', 'rows2', [['face', 'YOU'], ['face', 'RIVAL']], 1.7]] },
    },
    outro: {
      set: { YOU: [0, 30, 3.14], M1: [2.2, 31.8, 'YOU'], COACH: [-6, 24, 'YOU'], ball: [3, 27] },
      open: { t: 3.4, cam: ['orbit', 'YOU', 4.6, 1.5, 0.35], do: [['YOU', 'emote', 'cheer', 2.8], ['M1', 'emote', 'cheer', 2.8], ['*', 'cheer', 0.5]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'], do: [['*', 'prop', 'shirt', 'COACH'], ['COACH', 'walk', -1.5, 28.4], ['COACH', 'emote', 'give', 0]], hold: 3.2 },
        { cams: [[0, ['close', 'YOU']], [1.2, ['orbit', 'YOU', 4.2, 1.4, 0.25]]], do: [['*', 'give', 'shirt', 'YOU'], ['YOU', 'wait', 0.5], ['YOU', 'emote', 'trophy', 0], ['COACH', 'emote', 'clap', 0]], hold: 3 },
      ],
      end: { t: 2.8, cam: ['orbit', 'YOU', 5.5, 2.4, 0.4], do: [['M1', 'emote', 'clap', 0], ['*', 'cheer', 0.4]] },
    },
  },
  bp2: {
    intro: {
      set: { YOU: [0, 40, 0], M1: [-9, 33, 'YOU'], COACH: [7, 35, 'YOU'], RIVAL: [-14, 30, 'YOU'], R1: [-15.5, 28.5, 'YOU'], ball: 'M1' },
      open: { t: 4.6, cams: [[0, ['fly', [12, 7, 28], [6, 2.2, 33], 'YOU', 3.4]], [2.1, ['goal', 1]]], do: [['M1', 'pass', 'YOU'], ['YOU', 'trap'], ['YOU', 'shoot', 1, 3.6, 2.4], ['COACH', 'emote', 'fold', 0]] },
      lines: [
        { cam: ['ots', 'COACH', 'YOU'], do: [['COACH', 'emote', 'aim', 1.8]] },
        { cams: [[0, ['track', 'RIVAL']], [2.3, ['close', 'RIVAL']]], do: [['RIVAL', 'jog', -4, 37.6], ['RIVAL', 'emote', 'shrug', 1.4], ['R1', 'jog', -5.6, 35.8], ['R1', 'emote', 'laugh', 0]], hold: 3 },
        { cams: [[0, ['low', 'YOU']], [1.8, ['eyes', 'YOU']], [2.2, ['low', 'YOU', 0.9, 3.4]], [2.7, ['ballcam']], [3.3, ['goal', 1]]], do: [['*', 'ball', 'YOU'], ['YOU', 'face', 0, 55], ['YOU', 'juggle', 1.8], ['YOU', 'glare'], ['YOU', 'charge', 0.6], ['YOU', 'shoot', 1, -4.2, 2.8, 'power'], ['*', 'at', 1.8, 'lines', 'focus', 0.5]], hold: 5.4 },
      ],
      end: { t: 2.2, cam: ['two', 'RIVAL', 'YOU'], do: [['RIVAL', 'emote', 'shock', 0], ['R1', 'emote', 'shock', 0]] },
    },
    outro: {
      set: { YOU: [0, 20, 3.14], COACH: [3, 16.5, 'YOU'], M1: [-2.5, 21.5, 'YOU'], ball: [5, 24] },
      open: { t: 3.2, cam: ['wide', 0, 20, 16, 7, 0.15], do: [['YOU', 'emote', 'pump', 2.6], ['M1', 'emote', 'cheer', 2.6], ['*', 'crowd', 1], ['*', 'cheer', 1]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'emote', 'clap', 2.4], ['*', 'at', 1.6, 'cheer', 1]] },
      ],
      end: { t: 2.4, cam: ['low', 'YOU'], do: [['YOU', 'emote', 'wave', 0], ['*', 'cheer', 1]] },
    },
  },
  bp3: {
    intro: {
      set: { RIVAL: [0, 30, 3.14], R1: [-2.6, 32, 'YOU'], R2: [2.6, 32.4, 'YOU'], YOU: [0, 21, 0], COACH: [-3, 18.5, 'RIVAL'], ball: 'RIVAL' },
      open: { t: 3.8, cam: ['low', 'RIVAL'], do: [['RIVAL', 'juggle', 3.6], ['R1', 'emote', 'fold', 0], ['R2', 'emote', 'laugh', 0]] },
      lines: [
        { cams: [[0, ['ots', 'RIVAL', 'YOU']], [1.3, ['wide', 0, 18, 11, 4.5, 0.15]]], do: [['RIVAL', 'kick', 1.5, 0.3, 13, 1.5], ['*', 'at', 1.9, 'boom', 1.5, 13]], hold: 3.4 },
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'walk', -1.6, 20.2]] },
        { cam: ['low', 'YOU'], do: [['YOU', 'emote', 'aim', 0]] },
      ],
      end: { t: 2.2, cam: ['two', 'YOU', 'RIVAL'], do: [['YOU', 'emote', 'stance', 0], ['RIVAL', 'emote', 'fold', 0]] },
    },
    outro: {
      set: { RIVAL: [1.5, 27, 3.14], YOU: [-0.5, 23, 0], R1: [4, 29, 'RIVAL'], ball: [6, 31] },
      open: { t: 2.8, cam: ['close', 'RIVAL'], do: [['RIVAL', 'emote', 'sad', 0], ['R1', 'emote', 'sad', 0]] },
      lines: [
        { cam: ['ots', 'RIVAL', 'YOU'], do: [['RIVAL', 'emote', 'sad', 0]] },
        { cams: [[0, ['close', 'YOU']], [1.0, ['lead', 'YOU']]], do: [['YOU', 'wait', 0.8], ['YOU', 'walk', -1, 12], ['*', 'at', 2.15, 'slow', 0.35, 1.4], ['*', 'at', 2.2, 'boom', 6, 31]], hold: 4.6 },
      ],
      end: { t: 2.4, cam: ['lead', 'YOU'], do: [['YOU', 'walk', -1, 7]] },
    },
  },
  bp4: {
    intro: {
      set: { YOU: [30, 0, -1.57], M1: [31.6, 2.2, -1.57], M2: [31.6, -2.2, -1.57], COACH: [33.2, 0.6, -1.57], ROGUE: [-2, 5, 'YOU'], RIVAL: [-8, -6, 'YOU'], R1: [-10, -8, 'YOU'], ball: 'ROGUE' },
      open: { t: 5, cam: ['fly', [-10, 26, -38], [17, 2.2, -6], 'YOU', 4.6], do: [['YOU', 'jog', 9, 0], ['M1', 'jog', 12.8, 2.8], ['M2', 'jog', 12.8, -2.8], ['COACH', 'jog', 13.8, 0.4], ['ROGUE', 'juggle', 30], ['*', 'cheer', 1]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'walk', 9.8, 1.7]] },
        { cam: ['low', 'ROGUE'], do: [['ROGUE', 'juggle', 1.8], ['ROGUE', 'pass', 'YOU']], hold: 3.4 },
        { cam: ['ots', 'YOU', 'ROGUE'], do: [['YOU', 'trap'], ['YOU', 'juggle', 2.4]] },
        { cams: [[0, ['close', 'ROGUE']], [1.6, ['two', 'YOU', 'ROGUE']]], do: [['ROGUE', 'emote', 'wave', 1.2], ['ROGUE', 'walk', -8, 12]], hold: 3.4 },
      ],
      end: { t: 2.6, cam: ['two', 'YOU', 'RIVAL'], do: [['RIVAL', 'jog', 4, -1.5], ['RIVAL', 'emote', 'fold', 0], ['YOU', 'face', 'RIVAL']] },
    },
    outro: {
      set: { YOU: [0, 20, 3.14], M1: [-3, 19, 'YOU'], M2: [2.8, 18.2, 'YOU'], COACH: [4.5, 16, 'YOU'], ROGUE: [-22, 34, 'YOU'] },
      open: { t: 3, cam: ['track', 'ROGUE'], do: [['ROGUE', 'sprint', -1.8, 21.8], ['*', 'lines', 'rush', 2.4]] },
      lines: [
        { cam: ['two', 'ROGUE', 'YOU'], do: [['ROGUE', 'emote', 'five', 1.0], ['YOU', 'emote', 'five', 1.0], ['*', 'at', 0.22, 'impact'], ['*', 'at', 0.22, 'word', 'SMACK!', '#3dffb0']], hold: 3 },
        { cam: ['group', ['YOU', 'ROGUE', 'M1', 'M2', 'COACH']], do: [['COACH', 'emote', 'pump', 2.2], ['M1', 'emote', 'cheer', 2.2], ['M2', 'emote', 'cheer', 2.2], ['ROGUE', 'emote', 'flex', 0]] },
      ],
      end: { t: 2.8, cam: ['orbit', 'ROGUE', 4.2, 1.5, 0.5], do: [['*', 'cheer', 1]] },
    },
  },
  cl1: {
    intro: {
      set: { COACH: [0, 9, 'YOU'], YOU: [0, 13, 3.14], M1: [-3.2, 14.6, 3.14], RIVAL: [1.2, 25, 'YOU'], R1: [-2, 27, 'YOU'], ball: [3.5, 18] },
      open: { t: 4.2, cam: ['wide', 0, 16, 16, 8, 0.14], do: [['*', 'moon'], ['*', 'ballup', 3.5, 18, 7], ['*', 'at', 1.4, 'sfx', 'boing']] },
      lines: [
        { cams: [[0, ['ots', 'COACH', 'YOU']], [2.6, ['low', 'M1', 0.3, 4]]], do: [['M1', 'wait', 1.2], ['M1', 'giant'], ['M1', 'emote', 'flex', 0]], hold: 3.6 },
        { cam: ['low', 'RIVAL'], do: [['RIVAL', 'walk', 1, 19.5], ['RIVAL', 'giant'], ['RIVAL', 'emote', 'laugh', 0]] },
        { cams: [[0, ['close', 'YOU']], [1.6, ['low', 'YOU']]], do: [['YOU', 'emote', 'shrug', 1.2], ['YOU', 'giant'], ['YOU', 'emote', 'flex', 0]], hold: 3 },
      ],
      end: { t: 2, cam: ['two', 'YOU', 'RIVAL'], do: [['*', 'moon', false]] },
    },
    outro: {
      set: { YOU: [0, 0, 3.14], M1: [2.6, 1.4, 'YOU'], M2: [-2.6, 1.4, 'YOU'], COACH: [0, -4.5, 'YOU'] },
      open: { t: 3.4, cam: ['orbit', 'YOU', 5.5, 1.8, 0.4], do: [['YOU', 'emote', 'dance', 0], ['M1', 'emote', 'dance', 0], ['M2', 'emote', 'robot', 0], ['*', 'confetti', 5], ['*', 'cheer', 0.8]] },
      lines: [
        { cam: ['close', 'COACH'], do: [['COACH', 'emote', 'shrug', 1.6]] },
      ],
      end: { t: 2.6, cam: ['group', ['YOU', 'M1', 'M2', 'COACH']], do: [['COACH', 'emote', 'dance', 0], ['YOU', 'emote', 'dance', 0]] },
    },
  },
  cl2: {
    intro: {
      set: { RIVAL: [-6, 4, 0.4], YOU: [4, 26, 3.14], COACH: [12, 22, 'YOU'], M1: [-5, 30, 3.14], ball: 'RIVAL' },
      open: { t: 4, cams: [[0, ['track', 'RIVAL', 1]], [2.1, ['two', 'YOU', 'RIVAL']]], do: [['RIVAL', 'dribble', 2.2, 20.6], ['RIVAL', 'fall', 1, 1.6], ['YOU', 'wait', 2.0], ['YOU', 'slide', 2.6, 21.4, 'win'], ['*', 'at', 1.95, 'slow', 0.3, 0.7]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'] },
        { cam: ['close', 'RIVAL'], do: [['RIVAL', 'emote', 'aim', 1.6]] },
        { cam: ['low', 'YOU'], do: [['YOU', 'emote', 'shush', 0]] },
      ],
      end: { t: 2, cam: ['two', 'YOU', 'RIVAL'] },
    },
    outro: {
      set: { YOU: [0, -40, 0], M1: [-2.3, -40, 0], M2: [2.3, -40, 0], M3: [4.6, -40, 0], COACH: [-7, -36, 'YOU'] },
      open: { t: 3.4, cam: ['fly', [-7, 0.7, -36.5], [7, 0.7, -36.5], [0, 1.3, -40], 3.4], do: [['YOU', 'emote', 'fold', 0], ['M1', 'emote', 'fold', 0], ['M2', 'emote', 'fold', 0], ['M3', 'emote', 'fold', 0]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'emote', 'clap', 2.6]] },
      ],
      end: { t: 4.4, cam: ['group', ['M1', 'YOU', 'M2', 'M3']], do: [['*', 'at', 1.0, 'panels', 'cols3', [['close', 'M1'], ['close', 'YOU'], ['close', 'M2']], 1.8, 'THE WALL', '#ffcb3d'], ['YOU', 'face', 0, -30], ['M1', 'face', -2.3, -30], ['M2', 'face', 2.3, -30], ['M3', 'face', 4.6, -30], ['YOU', 'emote', 'flex', 0], ['M1', 'emote', 'flex', 0], ['M2', 'emote', 'flex', 0], ['M3', 'emote', 'flex', 0]] },
    },
  },
  cl3: {
    intro: {
      goals: [1.5, 1.75],
      set: { YOU: [0, 44, 0], COACH: [3.4, 41, 'YOU'], ball: 'YOU' },
      open: { t: 3.4, cam: ['goal', 1], do: [['YOU', 'juggle', 3.2]] },
      lines: [
        { cam: ['ots', 'COACH', 'YOU'], do: [['COACH', 'face', 0, 55], ['COACH', 'emote', 'aim', 1.6], ['COACH', 'face', 'YOU']], hold: 3 },
        { cams: [[0, ['eyes', 'YOU']], [0.75, ['close', 'YOU']], [1.15, ['ballcam']], [1.75, ['goal', 1]]], do: [['YOU', 'face', 0, 55], ['YOU', 'glare'], ['YOU', 'wait', 0.4], ['YOU', 'charge', 0.45], ['YOU', 'shoot', 1, 0, 0.9, 'power']], hold: 3.8 },
      ],
      end: { t: 2, cam: ['close', 'COACH'], do: [['COACH', 'emote', 'shock', 0]] },
    },
    outro: {
      goals: [1.5, 1.75],
      set: { YOU: [-2, 43, 0], COACH: [3.4, 40.5, 'YOU'], ball: 'YOU' },
      open: { t: 3.2, cams: [[0, ['follow', 'YOU']], [0.9, ['goal', 1]]], do: [['YOU', 'face', 0, 55], ['YOU', 'shoot', 1, 0.9, 1.3]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'emote', 'shock', 1.4], ['COACH', 'emote', 'clap', 0], ['YOU', 'emote', 'shush', 0]] },
      ],
    },
  },
  cl4: {
    intro: {
      set: { IRONCLAD: [0, 40, 3.14], M1: [0, 25, 0], YOU: [-8, 30, 'IRONCLAD'], COACH: [-10.5, 28.5, 'IRONCLAD'], ball: 'M1' },
      open: { t: 4, cams: [[0, ['track', 'M1', -1]], [2.0, ['low', 'IRONCLAD', 0.6, 4]]], do: [['M1', 'dribble', 0, 38.6], ['M1', 'fall', 1, 1.8], ['IRONCLAD', 'wait', 2.1], ['IRONCLAD', 'trap'], ['IRONCLAD', 'emote', 'stance', 0], ['*', 'at', 2.15, 'sfx', 'punch'], ['*', 'at', 2.15, 'impact'], ['*', 'at', 2.15, 'word', 'WHAM!', '#c9ced8']] },
      lines: [
        { cams: [[0, ['eyes', 'IRONCLAD']], [1.1, ['low', 'IRONCLAD']]], do: [['IRONCLAD', 'glare'], ['IRONCLAD', 'emote', 'fold', 0], ['*', 'lines', 'focus', 1.0]] },
        { cams: [[0, ['track', 'YOU']], [2.0, ['two', 'YOU', 'IRONCLAD']]], do: [['YOU', 'jog', -0.8, 37.6]], hold: 3.2 },
        { cam: ['close', 'IRONCLAD'], do: [['IRONCLAD', 'emote', 'aim', 1.4]] },
      ],
      end: { t: 3.9, cam: ['two', 'YOU', 'IRONCLAD'], do: [['YOU', 'emote', 'stance', 0], ['IRONCLAD', 'emote', 'stance', 0], ['YOU', 'glare'], ['*', 'at', 0.9, 'panels', 'rows2', [['face', 'YOU'], ['face', 'IRONCLAD']], 1.7]] },
    },
    outro: {
      set: { YOU: [0, 22, 0], IRONCLAD: [0.4, 29, 3.14], COACH: [-9, 19, 'YOU'], M1: [-6, 17.5, 'YOU'], ball: 'YOU' },
      open: { t: 4.8, cams: [[0, ['track', 'YOU', 1, 6]], [0.8, ['orbit', 'YOU', 4.4, 1.2, 2.0]], [1.35, ['track', 'YOU', 1, 6]]], do: [['YOU', 'dribble', 0, 27.4], ['YOU', 'feint', 1], ['YOU', 'dribble', -2.4, 33.5], ['IRONCLAD', 'wait', 0.9], ['IRONCLAD', 'slide', 0.8, 27.6], ['IRONCLAD', 'fall', -1, 1.2], ['*', 'at', 0.8, 'slow', 0.22, 1.0]] },
      lines: [
        { cam: ['two', 'IRONCLAD', 'YOU'], do: [['IRONCLAD', 'walk', -1.2, 31.9]], hold: 3.6 },
        { cam: ['close', 'COACH'], do: [['COACH', 'emote', 'shock', 1.2], ['COACH', 'emote', 'pump', 0]] },
      ],
      end: { t: 2.6, cam: ['orbit', 'IRONCLAD', 4.2, 1.5, 0.4], do: [['IRONCLAD', 'emote', 'flex', 0], ['YOU', 'emote', 'flex', 0], ['*', 'cheer', 1]] },
    },
  },
  vc1: {
    intro: {
      set: { COACH: [-3, 4, 'YOU'], YOU: [0, 6.5, 3.14], M1: [3, 7.5, 3.14], RIVAL: [1.5, 15, 'YOU'], R1: [4.5, 16, 'YOU'], R2: [-2, 16.5, 'YOU'] },
      open: { t: 4.6, cam: ['fly', [0, 24, -26], [5, 3.4, -4], [0, 3, 0], 4.4], do: [['*', 'cores', 0, 0, 3], ['*', 'fireworks', 5], ['*', 'cheer', 1]] },
      lines: [
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'face', 0, 0], ['COACH', 'emote', 'aim', 1.8]] },
        { cam: ['close', 'RIVAL'], do: [['RIVAL', 'walk', 1, 11.5], ['RIVAL', 'emote', 'fold', 0]] },
        { cams: [[0, ['low', 'YOU', 0.5, 4]], [1.1, ['eyes', 'YOU']], [1.55, ['close', 'YOU']], [2.1, ['two', 'YOU', 'RIVAL']]], do: [['*', 'dark', 'YOU'], ['*', 'cores', 'YOU'], ['YOU', 'emote', 'snap', 0], ['YOU', 'glare'], ['*', 'at', 1.1, 'lines', 'focus', 0.7], ['*', 'at', 1.8, 'snapfx', 'YOU'], ['*', 'at', 1.8, 'impact'], ['*', 'at', 2.6, 'dark', false], ['RIVAL', 'wait', 1.9], ['RIVAL', 'emote', 'shock', 0]], hold: 3.8 },
      ],
      end: { t: 2.2, cam: ['two', 'YOU', 'RIVAL'] },
    },
    outro: {
      set: { YOU: [0, 10, 3.14], COACH: [-3, 7, 'YOU'], M1: [3, 8, 'YOU'] },
      open: { t: 3, cam: ['orbit', 'YOU', 4.6, 1.6, 0.35], do: [['*', 'cores', 'YOU'], ['YOU', 'emote', 'flex', 0], ['*', 'cheer', 1]] },
      lines: [
        { cams: [[0, ['low', 'YOU']], [2.0, ['close', 'YOU']]], do: [['YOU', 'emote', 'snap', 0], ['*', 'at', 1.8, 'snapfx', 'YOU'], ['*', 'at', 1.9, 'cheer', 1]], hold: 3.2 },
        { cam: ['group', ['COACH', 'YOU', 'M1']], do: [['COACH', 'emote', 'cheer', 0], ['M1', 'emote', 'cheer', 0], ['*', 'fireworks', 6]] },
      ],
      end: { t: 2.4, cam: ['wide', 0, 8, 18, 8, 0.2], do: [['YOU', 'emote', 'cheer', 0], ['*', 'fireworks', 4]] },
    },
  },
  vc2: {
    intro: {
      tier: 5,
      set: { RIVAL: [0, 14, 3.14], R1: [-2.4, 15, 3.14], R2: [2.4, 15, 3.14], R3: [-4.8, 16, 3.14], R4: [4.8, 16, 3.14], YOU: [0, 6, 0], COACH: [-3, 4, 'RIVAL'], M1: [2.6, 4.6, 0] },
      open: { t: 3.6, cam: ['fly', [-11, 1.6, 9.5], [11, 1.6, 9.5], [0, 1.5, 15], 3.4], do: [['RIVAL', 'emote', 'fold', 0], ['R1', 'emote', 'fold', 0], ['R2', 'emote', 'fold', 0], ['R3', 'emote', 'fold', 0], ['R4', 'emote', 'fold', 0]] },
      lines: [
        { cam: ['low', 'RIVAL'] },
        { cams: [[0, ['close', 'COACH']], [1.6, ['wide', 0, 0, 34, 16, 0.12]]], do: [['*', 'at', 1.6, 'cheer', 1]], hold: 3.6 },
        { cams: [[0, ['zoom', 'YOU']], [1.5, ['low', 'YOU']]], do: [['YOU', 'emote', 'point', 0], ['*', 'lines', 'focus', 1.4], ['*', 'at', 0.6, 'cheer', 1]] },
      ],
      end: { t: 2.2, cam: ['two', 'YOU', 'RIVAL'], do: [['YOU', 'emote', 'stance', 0]] },
    },
    outro: {
      tier: 5,
      set: { YOU: [0, 0, 0], COACH: [-3.5, -3, 'YOU'], M1: [3, -2, 'YOU'], M2: [-1.5, -4, 'YOU'] },
      open: { t: 4, cam: ['track', 'YOU', 1, 7], do: [['YOU', 'emote', 'plane', 0], ['YOU', 'glide', 8, 10, 6], ['YOU', 'glide', 0, 16, 6], ['YOU', 'glide', -6, 8, 6], ['*', 'cheer', 1], ['*', 'fireworks', 5]] },
      lines: [
        { cams: [[0, ['close', 'COACH']], [1.4, ['wide', -6, 8, 26, 10, 0.18]]], do: [['COACH', 'emote', 'listen', 2.6], ['*', 'cheer', 1], ['YOU', 'emote', 'listen', 0]], hold: 3.6 },
      ],
      end: { t: 2.8, cam: ['low', 'YOU'], do: [['YOU', 'emote', 'pump', 0], ['*', 'fireworks', 5], ['*', 'cheer', 1], ['*', 'confetti', 4]] },
    },
  },
  vc3: {
    intro: {
      set: { COACH: [-2.4, 10, 'YOU'], YOU: [1, 13, 3.14], M1: [-2.4, 14.6, 3.14], RIVAL: [1.6, 22, 'YOU'], R1: [-1.4, 23.6, 'YOU'] },
      open: { t: 3.8, cam: ['wide', 0, 16, 15, 6, 0.1], do: [['*', 'at', 0.5, 'lightning', 9, 26], ['*', 'at', 2.4, 'lightning', -11, 7]] },
      lines: [
        { cam: ['ots', 'COACH', 'YOU'] },
        { cam: ['low', 'RIVAL'], do: [['RIVAL', 'emote', 'laugh', 0], ['*', 'at', 1.1, 'lightning', 5, 27]] },
        { cam: ['track', 'YOU', -1, 7], do: [['YOU', 'glare'], ['*', 'panels', 'band', [['face', 'YOU']], 1.1, 'GO!', '#3dd8ff'], ['YOU', 'sprint', 14, 24], ['YOU', 'sprint', 2, 15], ['YOU', 'emote', 'stance', 0], ['*', 'at', 0.1, 'lines', 'rush', 2.6]], hold: 4.8 },
      ],
      end: { t: 2.2, cam: ['two', 'YOU', 'RIVAL'], do: [['*', 'at', 0.8, 'lightning', -6, 30]] },
    },
    outro: {
      set: { YOU: [0, 0, 3.14], COACH: [0, -4.5, 'YOU'], M1: [2.6, 1, 'YOU'], M2: [-2.6, 1, 'YOU'] },
      open: { t: 3.2, cam: ['orbit', 'YOU', 5, 1.6, 0.4], do: [['YOU', 'emote', 'meteor', 0], ['*', 'at', 1.4, 'lightning', 10, 14]] },
      lines: [
        { cams: [[0, ['close', 'COACH']], [1.5, ['group', ['YOU', 'M1', 'M2', 'COACH']]]], do: [['COACH', 'emote', 'cheer', 0], ['M1', 'emote', 'cheer', 0], ['M2', 'emote', 'cheer', 0], ['YOU', 'emote', 'flex', 0], ['*', 'at', 1.2, 'lightning', 0, 26], ['*', 'cheer', 1]], hold: 3.4 },
      ],
    },
  },
  vc4: {
    intro: {
      set: { SOLARIS: [0, 16, 3.14], R1: [-3, 18, 3.14], R2: [3, 18, 3.14], YOU: [0, 3, 0], COACH: [-3, 1.5, 'SOLARIS'], M1: [3, 1.5, 0], M2: [-5.5, 0.5, 0] },
      open: { t: 5.2, cam: ['fly', [28, 32, -46], [7, 3.2, 1], [0, 2, 9.5], 4.8], do: [['*', 'trophy', 0, 9.5], ['*', 'fireworks', 8], ['*', 'cheer', 1]] },
      lines: [
        { cams: [[0, ['eyes', 'SOLARIS']], [1.0, ['low', 'SOLARIS', 0.5, 4]]], do: [['*', 'dark', 'SOLARIS'], ['SOLARIS', 'glare'], ['SOLARIS', 'glow'], ['SOLARIS', 'walk', 0, 12.4], ['*', 'lines', 'focus', 0.9]] },
        { cam: ['ots', 'YOU', 'SOLARIS'], do: [['*', 'dark', false], ['YOU', 'walk', 0, 6.6]] },
        { cam: ['close', 'SOLARIS'], do: [['SOLARIS', 'emote', 'fold', 0]] },
        { cam: ['two', 'COACH', 'YOU'], do: [['COACH', 'walk', -1.4, 5.4]] },
      ],
      end: { t: 4.6, cams: [[0, ['two', 'YOU', 'SOLARIS']], [1.0, ['eyes', 'YOU']], [1.5, ['low', 'YOU']]], do: [['YOU', 'glow'], ['YOU', 'glare'], ['YOU', 'face', 'SOLARIS'], ['YOU', 'emote', 'stance', 0], ['*', 'at', 1.0, 'lines', 'focus', 0.8], ['*', 'at', 2.0, 'panels', 'rows2', [['face', 'YOU'], ['face', 'SOLARIS']], 1.7]] },
    },
    outro: {
      set: { SOLARIS: [0, 12, 3.14], YOU: [0, 6, 0], COACH: [-4, 3, 'YOU'], M1: [3, 3, 'YOU'], M2: [-2.2, 2.6, 'YOU'] },
      open: { t: 3, cam: ['close', 'SOLARIS'], do: [['*', 'trophy', -3.5, 8.5], ['SOLARIS', 'emote', 'sad', 0]] },
      lines: [
        { cam: ['ots', 'SOLARIS', 'YOU'], do: [['SOLARIS', 'emote', 'sad', 1.4], ['SOLARIS', 'emote', 'laugh', 1.6]] },
        { cam: ['two', 'SOLARIS', 'YOU'], do: [['SOLARIS', 'walk', 0.3, 7.5], ['SOLARIS', 'emote', 'five', 0.8], ['YOU', 'wait', 2.0], ['YOU', 'emote', 'five', 0.8]], hold: 3.6 },
        { cams: [[0, ['close', 'COACH']], [2.0, ['low', 'YOU', 0.3, 4]]], do: [['*', 'at', 1.6, 'give', 'trophy', 'YOU'], ['YOU', 'wait', 1.8], ['YOU', 'emote', 'trophy', 0], ['*', 'at', 2, 'fireworks', 10], ['*', 'at', 2, 'confetti', 8], ['*', 'at', 2, 'cheer', 1], ['*', 'at', 2, 'slow', 0.4, 1.3], ['*', 'at', 2, 'lines', 'focus', 1.2], ['M1', 'wait', 2], ['M1', 'emote', 'cheer', 0], ['M2', 'wait', 2], ['M2', 'emote', 'cheer', 0], ['SOLARIS', 'wait', 2], ['SOLARIS', 'emote', 'cheer', 0]], hold: 4.4 },
      ],
      end: { t: 4.2, cam: ['orbit', 'YOU', 5.2, 2.2, 0.32], do: [['COACH', 'emote', 'cheer', 0], ['*', 'fireworks', 6]] },
    },
  },
};
