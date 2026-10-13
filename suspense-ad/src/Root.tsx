import {Composition} from 'remotion';
import {SuspenseAccountAd} from './SuspenseAccountAd';

export const RemotionRoot: React.FC = () => (
	<Composition
		id="SuspenseAccountAd"
		component={SuspenseAccountAd}
		durationInFrames={450}
		fps={30}
		width={1080}
		height={1920}
	/>
);
