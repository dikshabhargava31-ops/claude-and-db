import React from 'react';
import {Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {loadFont as loadCaveat} from '@remotion/google-fonts/Caveat';
import {loadFont as loadBricolage} from '@remotion/google-fonts/BricolageGrotesque';

export const hand = loadCaveat('normal', {weights: ['500', '700'], subsets: ['latin']}).fontFamily;
export const display = loadBricolage('normal', {weights: ['600', '800'], subsets: ['latin']}).fontFamily;

export const C = {
	paper: '#fbf8ef',
	ink: '#15182b',
	blue: '#1d3f8f',
	red: '#d22f2f',
	green: '#1f8a4c',
	graphite: '#4f545c',
	rule: 'rgba(84, 132, 210, 0.38)',
	margin: 'rgba(214, 58, 58, 0.6)',
	marker: 'rgba(255, 222, 70, 0.85)',
};

export const LINE = 88; // ruled-line pitch in px; line k sits at y = k * LINE
export const MARGIN_X = 150;

/** interpolate with clamping on both ends */
export const ip = (
	f: number,
	input: number[],
	output: number[],
	easing?: (t: number) => number,
) => interpolate(f, input, output, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

export const progress = (f: number, start: number, dur: number, easing = Easing.inOut(Easing.quad)) =>
	ip(f, [start, start + dur], [0, 1], easing);

/** Decaying shake offset that starts at `at`. */
export const shake = (f: number, at: number, dur: number, amp: number) => {
	const t = f - at;
	if (t < 0 || t > dur) return {x: 0, y: 0};
	const decay = 1 - t / dur;
	return {
		x: Math.sin(t * 2.7) * amp * decay,
		y: Math.cos(t * 3.3) * amp * 0.7 * decay,
	};
};

/** Off-white ruled ledger paper: CSS gradients only. */
export const Paper: React.FC<{children?: React.ReactNode; style?: React.CSSProperties}> = ({
	children,
	style,
}) => (
	<div
		style={{
			position: 'absolute',
			inset: 0,
			overflow: 'hidden',
			backgroundColor: C.paper,
			backgroundImage: [
				// soft vignette + age blotches
				'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(120, 95, 50, 0.13) 100%)',
				'radial-gradient(ellipse 60% 40% at 18% 12%, rgba(232, 214, 170, 0.35), transparent 70%)',
				'radial-gradient(ellipse 50% 35% at 85% 78%, rgba(225, 205, 160, 0.3), transparent 70%)',
				// red margin (double line)
				`linear-gradient(90deg, transparent ${MARGIN_X}px, ${C.margin} ${MARGIN_X}px ${MARGIN_X + 3}px, transparent ${MARGIN_X + 3}px ${MARGIN_X + 9}px, ${C.margin} ${MARGIN_X + 9}px ${MARGIN_X + 11}px, transparent ${MARGIN_X + 11}px)`,
				// faint blue ruled lines
				`repeating-linear-gradient(180deg, transparent 0 ${LINE - 2}px, ${C.rule} ${LINE - 2}px ${LINE}px)`,
				// fibre grain: three offset dot lattices with co-prime sizes so no pattern shows
				'radial-gradient(rgba(110, 85, 40, 0.07) 0.8px, transparent 1.3px)',
				'radial-gradient(rgba(110, 85, 40, 0.05) 0.7px, transparent 1.2px)',
				'radial-gradient(rgba(255, 255, 255, 0.6) 0.8px, transparent 1.4px)',
			].join(','),
			backgroundSize: ['100% 100%', '100% 100%', '100% 100%', '100% 100%', '100% 100%', '7px 7px', '11px 13px', '17px 19px'].join(
				',',
			),
			backgroundPosition: ['0 0', '0 0', '0 0', '0 0', '0 0', '0 0', '3px 5px', '9px 2px'].join(','),
			...style,
		}}
	>
		{children}
	</div>
);

/** Positions children on ruled line `line` (text sits on that line). */
export const OnLine: React.FC<{
	line: number;
	x: number;
	w?: number;
	align?: 'left' | 'right' | 'center';
	children: React.ReactNode;
	style?: React.CSSProperties;
}> = ({line, x, w, align = 'left', children, style}) => (
	<div
		style={{
			position: 'absolute',
			top: (line - 1) * LINE + 6,
			left: x,
			width: w,
			height: LINE,
			display: 'flex',
			alignItems: 'flex-end',
			justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
			...style,
		}}
	>
		{children}
	</div>
);

const PencilTool: React.FC<{wiggle: number}> = ({wiggle}) => (
	<div
		style={{
			position: 'absolute',
			width: 26,
			height: 190,
			transformOrigin: '50% 100%',
			transform: `translate(-50%, -100%) rotate(${32 + wiggle}deg)`,
			filter: 'drop-shadow(6px 10px 6px rgba(0,0,0,0.22))',
		}}
	>
		<div style={{height: 16, background: '#f29aa8', borderRadius: '6px 6px 0 0'}} />
		<div style={{height: 12, background: 'linear-gradient(90deg,#9aa0a8,#dfe3e8,#9aa0a8)'}} />
		<div style={{height: 124, background: 'linear-gradient(90deg,#d99a0b,#f6c935 45%,#e0a810)'}} />
		<div
			style={{
				height: 38,
				background: 'linear-gradient(180deg,#ecd0a6 0 70%, #3a3d44 70%)',
				clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
			}}
		/>
	</div>
);

const EraserTool: React.FC<{wiggle: number}> = ({wiggle}) => (
	<div
		style={{
			position: 'absolute',
			width: 78,
			height: 130,
			transformOrigin: '50% 100%',
			transform: `translate(-50%, -82%) rotate(${-18 + wiggle}deg)`,
			filter: 'drop-shadow(6px 10px 6px rgba(0,0,0,0.22))',
		}}
	>
		<div style={{height: 78, background: 'linear-gradient(90deg,#2f58b8,#4a78dc)', borderRadius: '10px 10px 0 0'}} />
		<div style={{height: 52, background: 'linear-gradient(90deg,#f1a3b0,#fbc3cc)', borderRadius: '0 0 12px 12px'}} />
	</div>
);

/** Handwriting reveal: wipes the content in left-to-right, with an optional pencil riding the edge. */
export const Write: React.FC<{
	start: number;
	dur: number;
	pencil?: boolean;
	children: React.ReactNode;
	style?: React.CSSProperties;
}> = ({start, dur, pencil = true, children, style}) => {
	const f = useCurrentFrame();
	const p = progress(f, start, dur, Easing.out(Easing.quad));
	const writing = p > 0 && p < 1;
	return (
		<span style={{position: 'relative', display: 'inline-block', ...style}}>
			<span
				style={{
					display: 'inline-block',
					// padding keeps Caveat's overhanging final glyph inside the clip
					paddingRight: '0.25em',
					marginRight: '-0.25em',
					clipPath: `inset(-40% ${(1 - p) * 100}% -40% -10%)`,
				}}
			>
				{children}
			</span>
			{pencil && writing ? (
				<span style={{position: 'absolute', left: `calc(${p} * (100% + 0.25em))`, top: '78%'}}>
					<PencilTool wiggle={Math.sin(f * 1.9) * 4} />
				</span>
			) : null}
		</span>
	);
};

/** Eraser rub-out: content disappears left-to-right behind a moving eraser, leaving crumbs. */
export const Erase: React.FC<{start: number; dur: number; children: React.ReactNode; seed: string}> = ({
	start,
	dur,
	children,
	seed,
}) => {
	const f = useCurrentFrame();
	const p = progress(f, start, dur, Easing.inOut(Easing.sin));
	const active = p > 0 && p < 1;
	const crumbs = new Array(9).fill(0).map((_, i) => {
		const born = start + (i / 9) * dur;
		const age = f - born;
		return {
			x: random(`${seed}x${i}`) * 100 * ((i + 1) / 9),
			y: 40 + random(`${seed}y${i}`) * 60,
			s: 5 + random(`${seed}s${i}`) * 7,
			o: age < 0 ? 0 : ip(age, [0, 4, 26], [0, 0.7, 0]),
			drift: age * 1.2,
		};
	});
	return (
		<span style={{position: 'relative', display: 'inline-block'}}>
			<span style={{display: 'inline-block', clipPath: `inset(-80% -40% -80% calc(${p * 140}% - 40%))`, opacity: ip(p, [0.9, 1], [1, 0])}}>
				{children}
			</span>
			{crumbs.map((c, i) => (
				<span
					key={i}
					style={{
						position: 'absolute',
						left: `${c.x}%`,
						top: `${c.y}%`,
						width: c.s,
						height: c.s * 0.6,
						borderRadius: '50%',
						background: '#c9a9ae',
						opacity: c.o,
						transform: `translateY(${c.drift}px)`,
					}}
				/>
			))}
			{active ? (
				<span style={{position: 'absolute', left: `${p * 100}%`, top: `${70 + Math.sin(f * 1.7) * 14}%`}}>
					<EraserTool wiggle={Math.sin(f * 1.3) * 7} />
				</span>
			) : null}
		</span>
	);
};

/** Hand-drawn ellipse that strokes itself on. */
export const DrawCircle: React.FC<{
	start: number;
	dur: number;
	w: number;
	h: number;
	color?: string;
	stroke?: number;
	style?: React.CSSProperties;
}> = ({start, dur, w, h, color = C.red, stroke = 7, style}) => {
	const f = useCurrentFrame();
	const p = progress(f, start, dur, Easing.out(Easing.cubic));
	// slightly overshooting loop so it reads as drawn by hand
	const d = `M ${w * 0.08} ${h * 0.62}
		C ${w * 0.02} ${h * 0.12}, ${w * 0.62} ${h * 0.02}, ${w * 0.93} ${h * 0.3}
		C ${w * 1.04} ${h * 0.55}, ${w * 0.78} ${h * 0.98}, ${w * 0.42} ${h * 0.94}
		C ${w * 0.12} ${h * 0.9}, ${w * 0.0} ${h * 0.55}, ${w * 0.24} ${h * 0.18}`;
	return (
		<svg width={w} height={h} style={{position: 'absolute', overflow: 'visible', ...style}}>
			<path
				d={d}
				fill="none"
				stroke={color}
				strokeWidth={stroke}
				strokeLinecap="round"
				pathLength={1}
				strokeDasharray={1}
				strokeDashoffset={1 - p}
			/>
		</svg>
	);
};

/** Highlighter swipe behind a word. */
export const Marker: React.FC<{start: number; dur?: number; color?: string; children: React.ReactNode}> = ({
	start,
	dur = 10,
	color = C.marker,
	children,
}) => {
	const f = useCurrentFrame();
	const p = progress(f, start, dur, Easing.out(Easing.quad));
	return (
		<span style={{position: 'relative', display: 'inline-block', zIndex: 0}}>
			<span
				style={{
					position: 'absolute',
					left: -10,
					right: -10,
					top: '18%',
					bottom: '4%',
					background: color,
					borderRadius: '6px 14px 8px 12px',
					transform: `scaleX(${p}) rotate(-1deg)`,
					transformOrigin: '0 50%',
					zIndex: -1,
				}}
			/>
			{children}
		</span>
	);
};

/** Bold sans headline block that slides/fades in and out. */
export const Headline: React.FC<{
	from: number;
	to: number;
	instantIn?: boolean;
	top?: number;
	size?: number;
	children: React.ReactNode;
}> = ({from, to, instantIn = false, top = 206, size = 104, children}) => {
	const f = useCurrentFrame();
	if (f < from || f >= to) return null;
	const inP = instantIn ? 1 : progress(f, from, 8, Easing.out(Easing.cubic));
	const outP = progress(f, to - 7, 7, Easing.in(Easing.cubic));
	return (
		<div
			style={{
				position: 'absolute',
				top,
				left: MARGIN_X + 40,
				right: 60,
				fontFamily: display,
				fontWeight: 800,
				fontSize: size,
				lineHeight: 1.02,
				letterSpacing: -2.5,
				color: C.ink,
				opacity: inP * (1 - outP),
				transform: `translateY(${(1 - inP) * 50 - outP * 40}px)`,
			}}
		>
			{children}
		</div>
	);
};
