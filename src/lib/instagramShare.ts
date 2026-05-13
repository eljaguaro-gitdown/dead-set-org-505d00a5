import { toast } from "sonner";
import { trackShare } from "./trackShare";

export type ShareContext = "setlist" | "app";

interface InstagramShareOptions {
  context: ShareContext;
  imageDataUrl?: string;
  setlistName?: string;
  setlistId?: string;
  posterUrl?: string;
}

const CAPTIONS = {
  setlist: [
    `Just built my dream Grateful Dead show on Dead-Set.Org 🌹⚡

50 years of live recordings. Zero algorithms. Pure Deadhead curation.

What would YOUR setlist look like?

🔗 dead-set.org`,

    `Still chasing that golden road to unlimited devotion 🌹 

Built my fantasy Dead show at dead-set.org — where every setlist tells a story and Cosmic Charlie guides the way.

What song opens your dream show?

🔗 dead-set.org`,

    `The music never stops 🌹🎸

Dead-Set.Org lets you craft your perfect Grateful Dead show from decades of Archive gems. Cosmic Charlie approved ✨

Build yours → dead-set.org`,
  ],
  app: [
    `The band may be gone but the music never stops 🌹⚡

Dead-Set.Org — built by Deadheads, for Deadheads. Discover rare gems, build your dream show, and explore 50 years of live recordings from the Archive.

No algorithms. Just heads. 🎸

🔗 dead-set.org`,

    `Found my new obsession 🌹

Dead-Set.Org is where Deadheads build dream setlists from 50 years of live recordings. Cosmic Charlie guides the way.

Heads only. Algorithms need not apply ⚡

🔗 dead-set.org`,

    `What if you could build your perfect Grateful Dead show? 🎹✨

Dead-Set.Org makes it real — decades of Archive recordings, endless combinations, one beautiful community.

The music never stops 🌹

🔗 dead-set.org`,
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCaption(opts: InstagramShareOptions): string {
  const base = opts.context === "setlist" && opts.setlistName
    ? `Check out "${opts.setlistName}" on Dead-Set.Org 🌹⚡\n\nBuilt from 50 years of live recordings. What does YOUR dream show look like?\n\n🔗 ${opts.posterUrl || "dead-set.org"}`
    : pickRandom(CAPTIONS[opts.context]);
  return base;
}

/** Convert a data URL to a File object for native sharing */
function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  } catch {
    return null;
  }
}

export async function shareToInstagram(opts: InstagramShareOptions): Promise<void> {
  const caption = getCaption(opts);
  const filename = opts.context === "setlist"
    ? `deadset-share-${Date.now()}.png`
    : `deadset-invite-${Date.now()}.png`;

  // 1. Always copy the caption
  try {
    await navigator.clipboard.writeText(caption);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = caption;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  // 2. If we have an image and native share is available, try sharing the file
  if (opts.imageDataUrl && navigator.canShare && navigator.share) {
    const file = dataUrlToFile(opts.imageDataUrl, filename);
    if (file && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: opts.setlistName || "Dead-Set.Org",
        });
        trackShare({
          shareType: opts.context === "setlist" ? "setlist" : "app_link",
          channel: "instagram",
          setlistId: opts.setlistId,
        });
        toast.success("Choose Instagram from your share sheet!");
        return;
      } catch {
        // User cancelled or Instagram not available in share sheet — fall through
      }
    }
  }

  // 3. If we have an image but no native share, download it
  if (opts.imageDataUrl) {
    const a = document.createElement("a");
    a.href = opts.imageDataUrl;
    a.download = filename;
    a.click();
  }

  // 4. Track and notify
  trackShare({
    shareType: opts.context === "setlist" ? "setlist" : "app_link",
    channel: "instagram",
    setlistId: opts.setlistId,
  });

  if (opts.imageDataUrl) {
    toast.success("Image saved & caption copied! Open Instagram and paste ✨");
  } else {
    toast.success("Caption copied! Open Instagram and paste ✨");
  }
}
