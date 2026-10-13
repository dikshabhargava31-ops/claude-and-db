import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, Sequence, getStaticFiles, staticFile, useCurrentFrame} from 'remotion';
import {SFX, T} from './timeline';
import {
	C,
	DrawCircle,
	Erase,
	Headline,
	LINE,
	Marker,
	OnLine,
	Paper,
	Write,
	display,
	hand,
	ip,
	progress,
	shake,
} from './ui';

// ---------- assets (all optional; picked up from ./assets when present) ----------

const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];

const findAsset = (base: string, exts: string[]) => {
	const files = getStaticFiles();
	for (const ext of exts) {
		const hit = files.find((file) => file.name.toLowerCase() === `${base}.${ext}`);
		if (hit) return staticFile(hit.name);
	}
	return null;
};

/** Background bed: low, ducked under every SFX hit, faded in/out. */
const musicVolume = (f: number) => {
	const base = 0.22;
	const ducked = 0.07;
	let v = base;
	for (const s of SFX) {
		const d = ip(f, [s.from - 4, s.from, s.from + Math.min(s.dur, 20), s.from + Math.min(s.dur, 20) + 8], [base, ducked, ducked, base]);
		v = Math.min(v, d);
	}
	return v * ip(f, [0, 8], [0, 1]) * ip(f, [T.end - 24, T.end], [1, 0]);
};

const Soundtrack: React.FC = () => {
	const music = findAsset('music', AUDIO_EXT);
	return (
		<>
			{music ? <Audio src={music} volume={musicVolume} /> : null}
			{SFX.map((s, i) => {
				const src = findAsset(`sfx/${s.name}`, AUDIO_EXT);
				if (!src) return null;
				return (
					<Sequence key={i} from={s.from} durationInFrames={s.dur} layout="none">
						<Audio src={src} volume={(f) => s.volume * ip(f, [s.dur - 6, s.dur], [1, 0])} />
					</Sequence>
				);
			})}
		</>
	);
};

// ---------- shared ledger bits ----------

const COL = {
	part: 185,
	drX: 572,
	crX: 812,
	colW: 230,
};

const handText = (size: number, color: string, weight = 700): React.CSSProperties => ({
	fontFamily: hand,
	fontSize: size,
	fontWeight: weight,
	color,
	lineHeight: 1,
	whiteSpace: 'nowrap',
});

const Rupee: React.FC = () => <span style={{fontFamily: display, fontWeight: 600, fontSize: '0.72em'}}>₹</span>;

// ---------- Page A: Trial balance doesn't tally -> Suspense A/c ----------

const TB_ROWS: [string, string, string][] = [
	['Capital', '', '60,000'],
	['Sales', '', '27,500'],
	['Drawings', '8,000', ''],
	['Purchases', '52,000', ''],
	['Cash', '40,000', ''],
];
const L_HEAD = 6;
const L_SUSP = L_HEAD + TB_ROWS.length + 1; // blank line left for the suspense entry
const L_TOTAL = L_SUSP + 1;
const L_NOTE = L_TOTAL + 2;

const PageA: React.FC = () => {
	const f = useCurrentFrame();
	const zoom = ip(f, [0, 18], [1.07, 1], Easing.out(Easing.cubic));
	const buzz = shake(f, T.errorBuzz, 14, 16);
	const flash = ip(f, [T.errorBuzz, T.errorBuzz + 2, T.errorBuzz + 12], [0, 0.16, 0]);
	const totalRed = f >= T.errorBuzz && f < T.writeNewTotal;
	const tick = progress(f, T.writeNewTotal + 12, 6, Easing.out(Easing.back(2)));
	const tableTop = (L_HEAD - 1) * LINE + 10;
	const tableBottom = L_TOTAL * LINE + 14;

	return (
		<Paper>
			<AbsoluteFill style={{transform: `translate(${buzz.x}px, ${buzz.y}px) scale(${zoom})`}}>
				<Headline from={0} to={T.headlineA2} instantIn>
					Trial Balance
					<br />
					<span style={{color: C.red}}>
						<Marker start={-4}>not tallying?</Marker>
					</span>
				</Headline>
				<Headline from={T.headlineA2} to={T.pageB + 12}>
					Just park it in a
					<br />
					<Marker start={T.headlineA2 + 6}>Suspense A/c.</Marker>
				</Headline>

				{/* column rules */}
				{[COL.drX - 8, COL.crX - 8, COL.crX + COL.colW + 6].map((x) => (
					<div
						key={x}
						style={{position: 'absolute', left: x, top: tableTop, height: tableBottom - tableTop, width: 3, background: C.margin, opacity: 0.55}}
					/>
				))}

				<OnLine line={L_HEAD} x={COL.part}>
					<span style={handText(62, C.ink)}>Particulars</span>
				</OnLine>
				<OnLine line={L_HEAD} x={COL.drX} w={COL.colW - 14} align="right">
					<span style={handText(62, C.ink)}>
						Dr. <Rupee />
					</span>
				</OnLine>
				<OnLine line={L_HEAD} x={COL.crX} w={COL.colW - 14} align="right">
					<span style={handText(62, C.ink)}>
						Cr. <Rupee />
					</span>
				</OnLine>

				{TB_ROWS.map(([name, dr, cr], i) => (
					<React.Fragment key={name}>
						<OnLine line={L_HEAD + 1 + i} x={COL.part}>
							<span style={handText(70, C.blue, 500)}>{name}</span>
						</OnLine>
						<OnLine line={L_HEAD + 1 + i} x={COL.drX} w={COL.colW - 14} align="right">
							<span style={handText(70, C.blue, 500)}>{dr || '—'}</span>
						</OnLine>
						<OnLine line={L_HEAD + 1 + i} x={COL.crX} w={COL.colW - 14} align="right">
							<span style={handText(70, C.blue, 500)}>{cr || '—'}</span>
						</OnLine>
					</React.Fragment>
				))}

				{/* the fix, written in pencil */}
				<OnLine line={L_SUSP} x={COL.part}>
					<Write start={T.writeSuspense} dur={14}>
						<span style={handText(70, C.graphite)}>Suspense A/c</span>
					</Write>
				</OnLine>
				<OnLine line={L_SUSP} x={COL.crX} w={COL.colW - 14} align="right">
					<Write start={T.writeSuspense + 15} dur={10}>
						<span style={handText(70, C.graphite)}>12,500</span>
					</Write>
				</OnLine>

				{/* totals */}
				<OnLine line={L_TOTAL} x={COL.part}>
					<span style={handText(72, totalRed ? C.red : C.ink)}>Total</span>
					<span style={{...handText(84, C.green), marginLeft: 22, transform: `scale(${tick})`, display: 'inline-block'}}>✓</span>
				</OnLine>
				<OnLine line={L_TOTAL} x={COL.drX} w={COL.colW - 14} align="right">
					<span style={handText(72, C.ink)}>1,00,000</span>
				</OnLine>
				<OnLine line={L_TOTAL} x={COL.crX} w={COL.colW - 14} align="right">
					<span style={{position: 'relative', display: 'inline-block', width: '100%', height: '100%'}}>
						<span style={{position: 'absolute', right: 0, bottom: 0}}>
							<Erase start={T.eraseTotal} dur={14} seed="total">
								<span style={{position: 'relative', display: 'inline-block'}}>
									<span style={handText(72, C.red)}>87,500</span>
									<DrawCircle start={T.errorBuzz} dur={10} w={250} h={120} style={{left: -34, top: -34}} />
								</span>
							</Erase>
						</span>
						<span style={{position: 'absolute', right: 0, bottom: 0}}>
							<Write start={T.writeNewTotal} dur={12}>
								<span style={handText(72, C.graphite)}>1,00,000</span>
							</Write>
						</span>
					</span>
				</OnLine>
				{/* double underline under totals */}
				{[0, 10].map((dy) => (
					<div
						key={dy}
						style={{position: 'absolute', left: COL.drX - 4, width: COL.colW * 2 + 14, top: L_TOTAL * LINE + 4 + dy, height: 3, background: C.ink, opacity: 0.75}}
					/>
				))}
				{/* scene 1 red note -> erased in scene 2 */}
				<OnLine line={L_NOTE} x={COL.part + 60}>
					<Erase start={T.eraseNote} dur={12} seed="note">
						<Write start={T.diffNote} dur={14} pencil={false}>
							<span style={{...handText(88, C.red), transform: 'rotate(-3deg)', display: 'inline-block'}}>
								Difference <Rupee />12,500 !!
							</span>
						</Write>
					</Erase>
				</OnLine>
				<OnLine line={L_NOTE + 1} x={COL.part + 120}>
					<Write start={T.forNow} dur={16}>
						<span style={handText(74, C.graphite, 500)}>
							(tallied... <span style={{textDecoration: 'underline', textDecorationThickness: 4}}>for now</span>)
						</span>
					</Write>
				</OnLine>
			</AbsoluteFill>
			<AbsoluteFill style={{background: C.red, opacity: flash}} />
		</Paper>
	);
};

// ---------- Page B: your CAREER is in suspense -> mentorship tallies it ----------

const CAREER = [
	{q: 'CA, CS or B.Com?', a: 'clear career roadmap'},
	{q: 'Accounts concepts?', a: 'basics, made solid'},
	{q: '2-year study plan?', a: 'weekly plan + tracking'},
	{q: 'Who guides me?', a: 'CA Mahendra Shekhawat'},
];
const L_TITLE = 6;

const PageB: React.FC = () => {
	const f = useCurrentFrame();
	const thud = shake(f, T.stamp, 12, 18);
	const stampP = progress(f, T.stamp - 6, 6, Easing.in(Easing.cubic));
	const stampSettle = ip(f, [T.stamp, T.stamp + 3, T.stamp + 7], [1, 0.95, 1]);

	return (
		<Paper>
			<AbsoluteFill style={{transform: `translate(${thud.x}px, ${thud.y}px)`}}>
				<Headline from={T.pageB} to={T.answers} instantIn size={96}>
					Your <span style={{color: C.red}}>CAREER</span> is
					<br />
					in <Marker start={T.pageB + 14}>suspense too.</Marker>
				</Headline>
				<Headline from={T.answers} to={T.pageC + 12}>
					We help you
					<br />
					<Marker start={T.answers + 8} color="rgba(120, 220, 150, 0.75)">
						tally it.
					</Marker>
				</Headline>

				<OnLine line={L_TITLE} x={190}>
					<Write start={T.writeTitle} dur={18}>
						<span style={{...handText(82, C.ink), textDecoration: 'underline', textDecorationThickness: 4, textUnderlineOffset: 10}}>
							My Career Suspense A/c
						</span>
					</Write>
				</OnLine>

				{CAREER.map(({q, a}, i) => {
					const line = L_TITLE + 1 + i * 2;
					const qStart = T.writeQs + i * 18;
					const aStart = T.answers + i * 9;
					const strike = progress(f, aStart - 2, 5);
					return (
						<React.Fragment key={q}>
							<OnLine line={line} x={190}>
								<Write start={qStart} dur={12}>
									<span style={handText(72, C.blue, 500)}>{q}</span>
								</Write>
							</OnLine>
							<OnLine line={line} x={880} w={150} align="center">
								<span style={{position: 'relative', display: 'inline-block'}}>
									<Write start={qStart + 10} dur={5} pencil={false}>
										<span style={{fontFamily: display, fontWeight: 800, fontSize: 72, color: C.red, lineHeight: 1}}>?</span>
									</Write>
									<span
										style={{
											position: 'absolute',
											left: -18,
											top: '46%',
											height: 6,
											width: `${strike * 260}%`,
											background: C.red,
											borderRadius: 3,
											transform: 'rotate(-6deg)',
										}}
									/>
								</span>
							</OnLine>
							<OnLine line={line + 1} x={240}>
								<Write start={aStart} dur={12} pencil={i === CAREER.length - 1}>
									<span style={handText(68, C.green)}>✓ {a}</span>
								</Write>
							</OnLine>
						</React.Fragment>
					);
				})}

				<OnLine line={L_TITLE + 9} x={190}>
					<Write start={T.difference} dur={10}>
						<span style={handText(96, C.ink)}>Difference = 0</span>
					</Write>
				</OnLine>

				{/* rubber stamp */}
				<div
					style={{
						position: 'absolute',
						left: 330,
						top: (L_TITLE + 9) * LINE + 16,
						opacity: stampP > 0 ? 0.9 : 0,
						transform: `scale(${ip(stampP, [0, 1], [3, 1]) * stampSettle}) rotate(-12deg)`,
						transformOrigin: '50% 50%',
						mixBlendMode: 'multiply',
					}}
				>
					<div
						style={{
							border: `9px solid ${C.red}`,
							outline: `3px solid ${C.red}`,
							outlineOffset: 6,
							borderRadius: 14,
							padding: '6px 26px 2px',
							fontFamily: display,
							fontWeight: 800,
							fontSize: 120,
							letterSpacing: 6,
							color: C.red,
							// worn ink: speckled holes punched through with a mask
							WebkitMaskImage:
								'radial-gradient(circle at 30% 40%, transparent 0 2px, #000 3px), radial-gradient(#000 60%, rgba(0,0,0,0.75))',
							WebkitMaskSize: '23px 19px, 100% 100%',
							WebkitMaskComposite: 'source-in',
						}}
					>
						TALLIED
					</div>
				</div>
			</AbsoluteFill>
		</Paper>
	);
};

// ---------- Page C: end card ----------

const PageC: React.FC = () => {
	const f = useCurrentFrame();
	const logo = findAsset('logo', ['png', 'svg', 'webp', 'jpg', 'jpeg']);
	const pop = (at: number) => {
		const p = progress(f, at, 9, Easing.out(Easing.back(1.6)));
		return {opacity: ip(p, [0, 0.4], [0, 1]), transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + p * 0.1})`};
	};
	const pulse = 1 + Math.max(0, Math.sin((f - T.pageC - 30) / 5)) * 0.04 * (f > T.pageC + 30 ? 1 : 0);

	return (
		<Paper>
			<AbsoluteFill
				style={{
					paddingLeft: 190,
					paddingRight: 70,
					paddingTop: 200,
					paddingBottom: 330,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'flex-start',
				}}
			>
				<div style={{...pop(T.pageC + 8), height: 190, display: 'flex', alignItems: 'center'}}>
					{logo ? (
						<Img src={logo} style={{height: 190, maxWidth: 600, objectFit: 'contain'}} />
					) : (
						<div style={{display: 'flex', alignItems: 'center', gap: 28}}>
							<div
								style={{
									width: 150,
									height: 150,
									borderRadius: 34,
									background: C.ink,
									color: C.paper,
									fontFamily: display,
									fontWeight: 800,
									fontSize: 58,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									transform: 'rotate(-4deg)',
								}}
							>
								IPA
							</div>
							<div style={{fontFamily: display, fontWeight: 600, fontSize: 54, color: C.ink, lineHeight: 1.05}}>
								IPA
								<br />
								Institute
							</div>
						</div>
					)}
				</div>

				<div style={{...pop(T.pageC + 14), marginTop: 70, ...handText(70, C.red)}}>Class 11 & 12 Commerce</div>
				<div
					style={{
						...pop(T.pageC + 18),
						marginTop: 14,
						fontFamily: display,
						fontWeight: 800,
						fontSize: 150,
						lineHeight: 0.98,
						letterSpacing: -4,
						color: C.ink,
					}}
				>
					Mentorship
					<br />
					Program
				</div>
				<div style={{...pop(T.pageC + 24), marginTop: 30, ...handText(66, C.blue, 700)}}>with CA Mahendra Shekhawat</div>

				<div style={{...pop(T.pageC + 30), marginTop: 70}}>
					<div
						style={{
							transform: `scale(${pulse})`,
							transformOrigin: '0 50%',
							background: C.red,
							color: '#fff',
							fontFamily: display,
							fontWeight: 800,
							fontSize: 62,
							padding: '28px 52px 32px',
							borderRadius: 999,
							boxShadow: '0 12px 0 #9c1f1f',
						}}
					>
						Apply now → link in bio
					</div>
				</div>
				<div style={{...pop(T.pageC + 36), marginTop: 44, ...handText(58, C.graphite, 500)}}>
					Clear your career's suspense account.
				</div>
			</AbsoluteFill>
		</Paper>
	);
};

// ---------- composition ----------

export const SuspenseAccountAd: React.FC = () => {
	const f = useCurrentFrame();
	// page turns: A scrolls up into B; B slides left into C
	const ab = progress(f, T.pageB, 12, Easing.inOut(Easing.cubic));
	const bc = progress(f, T.pageC, 12, Easing.inOut(Easing.cubic));
	const pageShadow = '0 0 60px rgba(0,0,0,0.35)';

	return (
		<AbsoluteFill style={{backgroundColor: '#2a2a2a'}}>
			{f < T.pageB + 12 ? (
				<AbsoluteFill style={{transform: `translateY(${-ab * 1920}px)`}}>
					<PageA />
				</AbsoluteFill>
			) : null}
			{f >= T.pageB && f < T.pageC + 12 ? (
				<AbsoluteFill style={{transform: `translate(${-bc * 1080}px, ${(1 - ab) * 1920}px)`, boxShadow: pageShadow}}>
					<PageB />
				</AbsoluteFill>
			) : null}
			{f >= T.pageC ? (
				<AbsoluteFill style={{transform: `translateX(${(1 - bc) * 1080}px)`, boxShadow: pageShadow}}>
					<PageC />
				</AbsoluteFill>
			) : null}
			<Soundtrack />
		</AbsoluteFill>
	);
};
