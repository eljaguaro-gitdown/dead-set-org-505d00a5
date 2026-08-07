// The gapless package's shipped index.d.ts lags its implementation:
// `webAudioIsDisabled` is a supported Queue option (src/gapless.js) that is
// missing from the published GaplessOptions. Remove this augmentation once
// upstream types catch up.
import "gapless";

declare module "gapless" {
  interface GaplessOptions {
    webAudioIsDisabled?: boolean;
  }
}
