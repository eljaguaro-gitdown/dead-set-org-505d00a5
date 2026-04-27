// Beta nudge email HTML — verbatim from deadset_beta_nudge_v3.html.
// DO NOT modify, summarize, or "improve" the markup. The design system,
// fonts, colors, and structure are all intentional.
//
// Personalization: contains exactly one merge token, {{first_name}}.
// At send time, replace `Hey Now, {{first_name}}` with `Hey Now, [name]`,
// or with just `Hey Now` (no comma) when first_name is missing/empty.

export const BETA_NUDGE_HTML = String.raw`<!DOCTYPE html>

<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Dead Set · Dispatch from the Lot</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Sans:wght@300;400;500&family=Caveat:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
background-color: #0a0a0a;
font-family: 'DM Sans', Arial, sans-serif;
color: #c8c4b0;
-webkit-font-smoothing: antialiased;
}

.email-wrapper {
max-width: 620px;
margin: 0 auto;
background-color: #0d0d0d;
}

/* HEADER */
.header { background-color: #0a0a0a; border-bottom: 1px solid #2a2410; padding: 28px 40px 24px; text-align: center; }
.header-rule-top { width: 100%; height: 1px; background: linear-gradient(90deg, transparent, #c9a84c 30%, #c9a84c 70%, transparent); margin-bottom: 20px; }
.logo-lockup { display: inline-block; text-align: center; }
.logo-reel { display: inline-block; width: 30px; height: 30px; opacity: 0.6; vertical-align: middle; margin-right: 8px; }
.charlie-mark { display: inline-block; width: 36px; height: 36px; border-radius: 50%; vertical-align: middle; margin-right: 12px; border: 1px solid #c9a84c; }
.charlie-portrait-wrap { text-align: center; margin-bottom: 18px; }
.charlie-portrait { width: 96px; height: 96px; border-radius: 50%; border: 2px solid #c9a84c; display: inline-block; }
.charlie-caption { display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.22em; color: #b09e78; text-transform: uppercase; margin-top: 10px; }
.site-name { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #c9a84c; letter-spacing: 0.08em; text-transform: uppercase; vertical-align: middle; }
.header-meta { display: block; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.18em; color: #b09e78; text-transform: uppercase; margin-top: 8px; }
.header-rule-bottom { width: 100%; height: 1px; background: linear-gradient(90deg, transparent, #2a2410 30%, #2a2410 70%, transparent); margin-top: 20px; }

/* SHOW HEADER */
.show-header { background-color: #0a0a0a; padding: 32px 40px 28px; text-align: center; border-bottom: 1px solid #1a1a12; }
.show-number { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.28em; color: #b09e78; text-transform: uppercase; margin-bottom: 10px; }
.show-title { font-family: 'Playfair Display', Georgia, serif; font-size: 30px; font-weight: 400; font-style: italic; color: #c9a84c; line-height: 1.2; margin-bottom: 12px; }
.show-tagline { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.28em; color: #b09e78; text-transform: uppercase; margin-bottom: 14px; }
.show-venue { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #a09880; letter-spacing: 0.12em; text-transform: uppercase; }

/* DIVIDER */
.divider { padding: 0 40px; margin: 0; }
.divider-line { height: 1px; background: linear-gradient(90deg, transparent, #2a2410 20%, #c9a84c 50%, #2a2410 80%, transparent); }
.divider-center { text-align: center; margin-top: -8px; }
.divider-glyph { display: inline-block; background: #0d0d0d; padding: 0 12px; color: #c9a84c; font-size: 13px; }

/* LETTER */
.letter-block { background-color: #0a0a0a; border-top: 1px solid #1e1c10; border-bottom: 1px solid #1e1c10; padding: 36px 48px 32px; }
.letter-inner { border-left: 2px solid #c9a84c; padding-left: 20px; }
.letter-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.22em; color: #b09e78; text-transform: uppercase; margin-bottom: 10px; }
.letter-headline { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 400; font-style: italic; color: #c9a84c; line-height: 1.25; margin-bottom: 18px; }
.letter-body { font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; font-weight: 300; color: #b0ac9a; line-height: 1.85; margin-bottom: 16px; }
.letter-body em { font-style: italic; color: #c9a84c; }
.letter-body strong { font-weight: 500; color: #c8c4b0; }

/* SET */
.set-section { padding: 32px 48px 8px; background-color: #0d0d0d; }
.set-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.28em; color: #b09e78; text-transform: uppercase; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #1e1c10; }

/* CHANGE ITEM */
.change-item { display: table; width: 100%; padding: 12px 0; border-bottom: 1px solid #161610; }
.change-item:last-child { border-bottom: none; }
.change-tag-cell { display: table-cell; width: 80px; vertical-align: top; padding-top: 2px; padding-right: 14px; }
.change-tag { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: 0.10em; text-transform: uppercase; padding: 3px 7px; border-radius: 2px; white-space: nowrap; }
.tag-fix { color: #7ab87a; background-color: #0f1a0f; border: 1px solid #2a4a2a; }
.tag-new { color: #c9a84c; background-color: #1a1408; border: 1px solid #4a3a18; }
.tag-improved { color: #7aa8c9; background-color: #0f141a; border: 1px solid #1e3a4a; }
.tag-beta { color: #c97aa8; background-color: #1a0f14; border: 1px solid #4a1e30; }
.change-text-cell { display: table-cell; vertical-align: top; }
.change-title { font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; font-weight: 500; color: #c8c4b0; line-height: 1.4; margin-bottom: 3px; }
.change-detail { font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; font-weight: 300; color: #7a7660; line-height: 1.6; }
.change-credit { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #c9a84c; letter-spacing: 0.08em; margin-top: 4px; display: block; }

/* ENCORE */
.encore-section { padding: 32px 48px 28px; background-color: #0d0d0d; }
.encore-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.28em; color: #b09e78; text-transform: uppercase; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #1e1c10; }
.encore-text { font-family: 'Caveat', cursive; font-size: 19px; color: #c8c4b0; line-height: 1.65; }
.encore-text strong { color: #c9a84c; }

/* FEEDBACK */
.feedback-box { background-color: #0f0e08; border: 1px solid #2a2410; border-left: 3px solid #c9a84c; border-radius: 2px; padding: 18px 20px; margin: 0 48px 28px; }
.backstage-badge { display: inline-block; background: linear-gradient(135deg, #d4a832 0%, #f0d060 40%, #c9921a 100%); border-radius: 20px; padding: 7px 16px 7px 12px; line-height: 1; vertical-align: middle; }
.backstage-badge-text { font-family: 'DM Sans', Arial, sans-serif; font-size: 13px; font-weight: 500; color: #0a0a0a; letter-spacing: 0.04em; vertical-align: middle; }
.feedback-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.18em; color: #b09e78; text-transform: uppercase; margin-top: 16px; margin-bottom: 8px; }
.feedback-text { font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; font-weight: 300; color: #b0ac9a; line-height: 1.7; margin-bottom: 12px; }
.feedback-links { display: block; margin: 16px 0 18px; }
.feedback-link-pill { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase; color: #c9a84c; background-color: #1a1408; border: 1px solid #4a3a18; border-radius: 2px; padding: 5px 12px; margin: 4px 6px 4px 0; text-decoration: none; }
.feedback-cta { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #0a0a0a; background-color: #c9a84c; padding: 10px 22px; border-radius: 2px; text-decoration: none; margin-top: 4px; }

/* SIGN-OFF */
.changelog-signoff { padding: 28px 48px 8px; background-color: #0d0d0d; }
.changelog-signoff-closing { font-family: 'Caveat', cursive; font-size: 16px; color: #a09880; display: block; margin-bottom: 2px; }
.changelog-signoff-name { font-family: 'Caveat', cursive; font-size: 28px; color: #c9a84c; display: block; margin-bottom: 4px; }
.changelog-signoff-title { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #a09880; letter-spacing: 0.14em; text-transform: uppercase; display: block; margin-bottom: 28px; }

/* STATS */
.stat-row { display: table; width: 100%; border-collapse: collapse; background-color: #0f0e08; border-top: 1px solid #1e1c10; border-bottom: 1px solid #1e1c10; }
.stat-cell { display: table-cell; width: 33.33%; padding: 16px 0; text-align: center; border-right: 1px solid #2a2410; }
.stat-cell:last-child { border-right: none; }
.stat-number { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; color: #c9a84c; display: block; line-height: 1; }
.stat-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: #a09880; text-transform: uppercase; display: block; margin-top: 5px; }

/* NEXT SHOW */
.next-show { background-color: #0f0e08; border-top: 1px solid #1e1c10; border-bottom: 1px solid #1e1c10; padding: 20px 48px; text-align: center; }
.next-show-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.22em; color: #6b6450; text-transform: uppercase; margin-bottom: 6px; }
.next-show-text { font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-style: italic; color: #a09880; }
.next-show-text strong { color: #c9a84c; }

/* FOOTER */
.footer { background-color: #080808; border-top: 1px solid #1a1408; padding: 24px 40px; text-align: center; }
.footer-rule { height: 1px; background: linear-gradient(90deg, transparent, #2a2410 30%, #2a2410 70%, transparent); margin-bottom: 18px; }
.footer-logo { font-family: 'Playfair Display', Georgia, serif; font-size: 13px; color: #a09880; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
.footer-copy { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #8a8270; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.9; }
.footer-copy a { color: #a09880; text-decoration: underline; }
.footer-tape-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #6b6450; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 14px; padding-top: 14px; border-top: 1px solid #2a2820; }
</style>
</head>
<body>
<div class="email-wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="header-rule-top"></div>
    <div class="logo-lockup">
      <span class="site-name">Dead Set</span>
    </div>
    <div class="header-meta">Dispatch from the Lot &nbsp;·&nbsp; Beta Crew &nbsp;·&nbsp; Apr 2026</div>
    <div class="header-rule-bottom"></div>
  </div>

  <!-- SHOW HEADER -->
  <div class="show-header">
    <div class="show-number">For the People Who Showed Up First</div>
    <div class="show-title">You Set the Tone.</div>
    <div class="show-tagline">Wait. Now. Discover.</div>
    <div class="show-venue">Dead Set Lab &nbsp;·&nbsp; San Francisco, CA &nbsp;·&nbsp; Beta Season</div>
  </div>

  <!-- STATS -->
  <div class="stat-row">
    <div class="stat-cell"><span class="stat-number">5</span><span class="stat-label">New features</span></div>
    <div class="stat-cell"><span class="stat-number">2</span><span class="stat-label">Weeks of builds</span></div>
    <div class="stat-cell"><span class="stat-number">100%</span><span class="stat-label">Song match rate</span></div>
  </div>

  <!-- LETTER -->
  <div class="letter-block">
    <div class="letter-inner">
      <div class="letter-eyebrow">Hey Now, {{first_name}}</div>
      <div class="letter-headline">The features rolling out right now started as your notes.</div>
      <p class="letter-body">
        You've been in the app. Building setlists, hitting favorites, leaving feedback —
        and I see every single one. What you're doing isn't beta testing.
        It's <strong>co-authorship</strong>.
      </p>
      <p class="letter-body">
        Two weeks of shipping, daily. Here's what got built — a lot of it because of you.
      </p>
    </div>
  </div>

  <!-- DIVIDER -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-center"><span class="divider-glyph">⌁</span></div>
  </div>

  <!-- SET I -->
  <div class="set-section">
    <div class="set-label">Set I &nbsp;·&nbsp; Under the Hood</div>

    <div class="change-item">
      <div class="change-tag-cell"><span class="change-tag tag-fix">Fix</span></div>
      <div class="change-text-cell">
        <div class="change-title">100% song match rate — finally</div>
        <div class="change-detail">Songs were silently vanishing from generated setlists. Fuzzy matching now handles apostrophes, abbreviations, and alternate spellings. Not one song gets left behind.</div>
      </div>
    </div>

    <div class="change-item">
      <div class="change-tag-cell"><span class="change-tag tag-fix">Fix</span></div>
      <div class="change-text-cell">
        <div class="change-title">Signup alerts</div>
        <div class="change-detail">We know the moment someone gets on the bus now. Each new arrival gets a proper welcome — and we get to say hey now in real time.</div>
      </div>
    </div>
  </div>

  <!-- DIVIDER -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-center"><span class="divider-glyph">⌂</span></div>
  </div>

  <!-- SET II -->
  <div class="set-section">
    <div class="set-label">Set II &nbsp;·&nbsp; New &amp; Better</div>

    <div class="change-item">
      <div class="change-tag-cell"><span class="change-tag tag-new">New</span></div>
      <div class="change-text-cell">
        <div class="change-title">Setlist Builder — your hands on the board</div>
        <div class="change-detail">Sometimes you already know the show you want. Start from scratch, search the catalog, drag to reorder, mark segues, and pull the exact live version from the Song Vault.</div>
      </div>
    </div>

    <div class="change-item">
      <div class="change-tag-cell"><span class="change-tag tag-improved">Better</span></div>
      <div class="change-text-cell">
        <div class="change-title">Liner notes that sound like Lemieux on SiriusXM</div>
        <div class="change-detail">Charlie's show descriptions now open with the emotional world of the night, name the structural arc, and land on what kind of night it actually was. Authoritative. Specific. Never generic.</div>
      </div>
    </div>

    <div class="change-item">
      <div class="change-tag-cell"><span class="change-tag tag-new">New</span></div>
      <div class="change-text-cell">
        <div class="change-title">The Aha Moment — built into every setlist</div>
        <div class="change-detail">Every show Charlie generates now contains one placement designed to make a veteran Deadhead stop and say <em>wait — did they actually do that?</em> Morning Dew mid-Set II. Attics after '72. He'll tell you exactly why.</div>
      </div>
    </div>

    <div class="change-item">
      <div class="change-tag-cell"><span class="change-tag tag-improved">Better</span></div>
      <div class="change-text-cell">
        <div class="change-title">Vibe is now a real atmosphere, not a label</div>
        <div class="change-detail">Pick <em>Dark &amp; Heavy</em> and party songs disappear. He's Gone, Wharf Rat, Morning Dew become the currency. Every energy selector now has structural consequences.</div>
      </div>
    </div>

    <div class="change-item">
      <div class="change-tag-cell"><span class="change-tag tag-beta">Beta</span></div>
      <div class="change-text-cell">
        <div class="change-title">Show Score — early preview</div>
        <div class="change-detail">Paste any setlist and get a read on how legendary that night actually was. Rough at the edges. That's why you're here.</div>
      </div>
    </div>
  </div>

  <!-- ENCORE -->
  <div class="encore-section">
    <div class="encore-label">Encore &nbsp;·&nbsp; From the lab</div>
    <p class="encore-text">
      You're the first set. Everything that comes after carries your fingerprints.<br><br>
      Keep telling me what's broken, what's missing, what would make you come back
      tomorrow — and then tell a friend. Not because we need the numbers.
      Because the right people finding this thing is the whole point.<br><br>
      The music never stopped. Now that's literally true.<br><br>
      <strong>Gratefully. Always.</strong>
    </p>
  </div>

  <!-- FEEDBACK -->
  <div class="feedback-box">
    <div>
      <span class="backstage-badge"><span class="backstage-badge-text">Backstage</span></span>
    </div>
    <div class="feedback-label">Your notes land directly in the next build</div>
    <p class="feedback-text">
      No ticket queue. No support inbox. Backstage is the room where Dead Set actually
      gets built — drop a wish, flag a bug, or share the show that hooked you.
    </p>
    <div class="feedback-links">
      <a href="https://dead-set.org/backstage" class="feedback-link-pill">✦ Wish List</a>
      <a href="https://dead-set.org/backstage" class="feedback-link-pill">⌁ Bug Log</a>
      <a href="https://dead-set.org/backstage" class="feedback-link-pill">◎ Share Your Set</a>
    </div>
    <a href="https://dead-set.org/backstage" class="feedback-cta">Go Backstage ↗</a>
  </div>

  <!-- SIGN-OFF -->
  <div class="changelog-signoff">
    <span class="changelog-signoff-closing">Yours in the long strange,</span>
    <span class="changelog-signoff-name">Jay</span>
    <span class="changelog-signoff-title">Dead Set · scrapedknee.com</span>
  </div>

  <!-- NEXT SHOW -->
  <div class="next-show">
    <div class="next-show-label">★ Artist Spotlight ★</div>
    <div class="next-show-text"><a href="https://dead-set.org/setlist/810cf89e-85c4-446d-9719-2108b8716201"><strong>Electric Jellyfish</strong></a></div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-rule"></div>
    <div class="footer-logo">Dead Set</div>
    <div class="footer-copy">
      Dead Set belongs to all of us.<br>
      By the community · For the community<br>
      <a href="https://www.scrapedknee.com">scrapedknee.com</a> · noreply@notify.dead-set.org
    </div>
    <div class="footer-tape-label">Master Reel · Beta Edition</div>
  </div>

</div>
</body>
</html>`
