import {Config} from '@remotion/cli/config';

// ./assets is the public dir, so staticFile('logo.png') -> assets/logo.png
Config.setPublicDir('./assets');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(18);
Config.setColorSpace('bt709');
// silent track when no audio assets exist, so every platform sees a normal A/V file
Config.setEnforceAudioTrack(true);
// Use the preinstalled headless shell if present (CI/cloud); otherwise Remotion downloads its own.
if (process.env.REMOTION_BROWSER) {
	Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
