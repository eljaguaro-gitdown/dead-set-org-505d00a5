import { useEffect } from "react";

const ADSENSE_CLIENT = "ca-pub-3069120120322820";
const SCRIPT_ID = "adsense-script";

/**
 * Loads the AdSense script only on pages that have sufficient publisher content.
 * Drop this component into content-rich pages (Browse, Index, Privacy, SetlistPoster).
 * Do NOT use on auth, 404, or other thin pages.
 */
const AdSenseLoader = () => {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, []);

  return null;
};

export default AdSenseLoader;
