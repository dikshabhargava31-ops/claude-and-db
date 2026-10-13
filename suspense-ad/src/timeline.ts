// Every beat in the ad, in frames at 30fps. SFX are keyed to these.
export const FPS = 30;

export const T = {
	// Scene 1: trial balance doesn't tally (hook, visible from frame 0)
	errorBuzz: 8,
	diffNote: 30,
	// Scene 2: erase the wrong total, park the difference in Suspense A/c
	headlineA2: 92,
	eraseTotal: 84,
	eraseNote: 99,
	writeSuspense: 112,
	writeNewTotal: 138,
	forNow: 152,
	// Scene 3: page turn -> "your CAREER is still in suspense"
	pageB: 180,
	writeTitle: 192,
	writeQs: 214,
	// Scene 4: mentorship answers every entry, difference = 0, stamped
	answers: 300,
	difference: 336,
	ding: 344,
	stamp: 352,
	// Scene 5: end card
	pageC: 375,
	end: 450,
} as const;

export type Sfx = {
	name: 'error-buzz' | 'eraser' | 'pencil' | 'ding' | 'stamp-thud' | 'whoosh';
	from: number;
	// cut the clip after this many frames so long files don't bleed into the next beat
	dur: number;
	volume: number;
};

export const SFX: Sfx[] = [
	{name: 'error-buzz', from: T.errorBuzz, dur: 30, volume: 0.8},
	{name: 'eraser', from: T.eraseTotal, dur: 30, volume: 0.9},
	{name: 'pencil', from: T.writeSuspense, dur: 40, volume: 0.85},
	{name: 'whoosh', from: T.pageB - 4, dur: 24, volume: 0.7},
	{name: 'pencil', from: T.writeTitle, dur: 80, volume: 0.8},
	{name: 'pencil', from: T.answers, dur: 42, volume: 0.8},
	{name: 'ding', from: T.ding, dur: 45, volume: 0.9},
	{name: 'stamp-thud', from: T.stamp, dur: 30, volume: 1},
	{name: 'whoosh', from: T.pageC - 4, dur: 24, volume: 0.7},
];
