// Dispatch 003 — "Firsts & Lasts" launch letter.
// Raw HTML source lives inline here so it can be edited without a build step.
// (Dispatch 002 was seeded from a design file and is base64-encoded; #003
// onward keep the source in the module.)

export const DISPATCH_003_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Dead Set · Firsts & Lasts</title>
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

  /* ── HEADER ── */
  .header {
    background-color: #0a0a0a;
    border-bottom: 1px solid #2a2410;
    padding: 28px 40px 24px;
    text-align: center;
  }
  .header-rule-top,
  .header-rule-bottom {
    width: 100%;
    height: 1px;
  }
  .header-rule-top {
    background: linear-gradient(90deg, transparent, #c9a84c 30%, #c9a84c 70%, transparent);
    margin-bottom: 20px;
  }
  .header-rule-bottom {
    background: linear-gradient(90deg, transparent, #2a2410 30%, #2a2410 70%, transparent);
    margin-top: 20px;
  }
  .logo-lockup { display: inline-block; text-align: center; }
  .logo-reel {
    display: inline-block;
    width: 30px; height: 30px;
    opacity: 0.6;
    vertical-align: middle;
    margin-right: 8px;
  }
  .site-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    color: #c9a84c;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    vertical-align: middle;
  }
  .header-meta {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.18em;
    color: #b09e78;
    text-transform: uppercase;
    margin-top: 8px;
  }

  /* ── SHOW HEADER ── */
  .show-header {
    background-color: #0a0a0a;
    padding: 36px 40px 30px;
    text-align: center;
    border-bottom: 1px solid #1a1a12;
  }
  .show-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.28em;
    color: #b09e78;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .show-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 34px;
    font-weight: 400;
    font-style: italic;
    color: #c9a84c;
    line-height: 1.18;
    margin-bottom: 14px;
  }
  .show-tagline {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.28em;
    color: #b09e78;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .show-venue {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #a09880;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* ── LETTER BODY ── */
  .letter-section {
    padding: 36px 48px 8px;
    background-color: #0d0d0d;
  }
  .letter-eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.28em;
    color: #b09e78;
    text-transform: uppercase;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #1e1c10;
  }
  .letter-salutation {
    font-family: 'Caveat', cursive;
    font-size: 26px;
    color: #c9a84c;
    margin-bottom: 18px;
    display: block;
  }
  .letter-body {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 15px;
    font-weight: 300;
    color: #b8b4a0;
    line-height: 1.85;
    margin-bottom: 18px;
  }
  .letter-body em { font-style: italic; color: #c9a84c; }
  .letter-body strong { font-weight: 500; color: #d4cca8; }
  .letter-body a {
    color: #c9a84c;
    text-decoration: none;
    border-bottom: 1px solid #4a3a18;
  }

  .pull-quote {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-style: italic;
    font-weight: 400;
    color: #c9a84c;
    line-height: 1.4;
    text-align: center;
    padding: 18px 24px;
    margin: 24px 0;
    border-top: 1px solid #2a2410;
    border-bottom: 1px solid #2a2410;
  }

  /* ── MOMENT / SHOUTOUT CARD ── */
  .moment-card {
    background-color: #0f0e08;
    border-left: 2px solid #c9a84c;
    padding: 22px 24px 20px;
    margin: 26px 0;
    border-radius: 0 2px 2px 0;
  }
  .moment-eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.24em;
    color: #b09e78;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .moment-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-style: italic;
    color: #c9a84c;
    line-height: 1.25;
    margin-bottom: 12px;
  }
  .moment-body {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 14px;
    font-weight: 300;
    color: #b0ac9a;
    line-height: 1.75;
    margin-bottom: 12px;
  }
  .moment-body em { font-style: italic; color: #c9a84c; }
  .moment-body strong { font-weight: 500; color: #d4cca8; }
  .moment-body a {
    color: #c9a84c;
    text-decoration: none;
    border-bottom: 1px solid #4a3a18;
  }

  /* ── DIVIDER ── */
  .divider { padding: 0 40px; margin: 28px 0 0; }
  .divider-line {
    height: 1px;
    background: linear-gradient(90deg, transparent, #2a2410 20%, #c9a84c 50%, #2a2410 80%, transparent);
  }
  .divider-center { text-align: center; margin-top: -8px; }
  .divider-glyph {
    display: inline-block;
    background: #0d0d0d;
    padding: 0 12px;
    color: #c9a84c;
    font-size: 13px;
  }

  /* ── FEATURE SPOTLIGHT ── */
  .feature-section {
    background-color: #0a0a0a;
    border-top: 1px solid #1e1c10;
    border-bottom: 1px solid #1e1c10;
    padding: 40px 48px 36px;
    text-align: center;
  }
  .feature-eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.28em;
    color: #b09e78;
    text-transform: uppercase;
    margin-bottom: 14px;
  }
  .feature-headline {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 32px;
    font-weight: 400;
    font-style: italic;
    color: #c9a84c;
    line-height: 1.18;
    margin-bottom: 14px;
  }
  .feature-subtitle {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 15px;
    font-weight: 300;
    color: #b0ac9a;
    line-height: 1.7;
    margin: 0 auto 22px;
    max-width: 460px;
  }
  .feature-subtitle em { font-style: italic; color: #c9a84c; }
  .feature-cta {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #0a0a0a;
    background-color: #c9a84c;
    padding: 12px 26px;
    border-radius: 2px;
    text-decoration: none;
    margin-bottom: 18px;
  }
  .feature-caption {
    font-family: 'Caveat', cursive;
    font-size: 18px;
    color: #a09880;
    margin-top: 8px;
  }
  .feature-caption a {
    color: #c9a84c;
    text-decoration: none;
    border-bottom: 1px solid #4a3a18;
  }

  /* ── SIGN-OFF ── */
  .signoff-section {
    padding: 36px 48px 28px;
    background-color: #0d0d0d;
  }
  .signoff-body {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 15px;
    font-weight: 300;
    color: #b8b4a0;
    line-height: 1.85;
    margin-bottom: 22px;
  }
  .signoff-body em { font-style: italic; color: #c9a84c; }
  .signoff-body strong { font-weight: 500; color: #d4cca8; }
  .signoff-closing {
    font-family: 'Caveat', cursive;
    font-size: 18px;
    color: #a09880;
    display: block;
    margin-bottom: 2px;
  }
  .signoff-name {
    font-family: 'Caveat', cursive;
    font-size: 30px;
    color: #c9a84c;
    display: block;
    margin-bottom: 6px;
  }
  .signoff-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #a09880;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    display: block;
  }

  /* ── BACKSTAGE BLOCK ── */
  .backstage-box {
    background-color: #0f0e08;
    border: 1px solid #2a2410;
    border-left: 3px solid #c9a84c;
    border-radius: 2px;
    padding: 22px 24px;
    margin: 0 48px 32px;
  }
  .backstage-badge {
    display: inline-block;
    background: linear-gradient(135deg, #d4a832 0%, #f0d060 40%, #c9921a 100%);
    border-radius: 20px;
    padding: 7px 16px 7px 12px;
    line-height: 1;
    vertical-align: middle;
    margin-bottom: 14px;
  }
  .backstage-badge-text {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #0a0a0a;
    letter-spacing: 0.04em;
    vertical-align: middle;
  }
  .backstage-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: #b09e78;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .backstage-text {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 14px;
    font-weight: 300;
    color: #b0ac9a;
    line-height: 1.7;
    margin-bottom: 16px;
  }
  .backstage-cta {
    display: inline-block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #0a0a0a;
    background-color: #c9a84c;
    padding: 10px 22px;
    border-radius: 2px;
    text-decoration: none;
  }

  /* ── FOOTER ── */
  .footer {
    background-color: #080808;
    border-top: 1px solid #1a1408;
    padding: 24px 40px;
    text-align: center;
  }
  .footer-rule {
    height: 1px;
    background: linear-gradient(90deg, transparent, #2a2410 30%, #2a2410 70%, transparent);
    margin-bottom: 18px;
  }
  .footer-logo {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13px;
    color: #a09880;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .footer-copy {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #8a8270;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    line-height: 1.9;
  }
  .footer-copy a {
    color: #a09880;
    text-decoration: underline;
  }
</style>
</head>
<body>

<div class="email-wrapper">

  <!-- HEADER -->
  <div class="header">
    <div class="header-rule-top"></div>
    <div class="logo-lockup">
      <svg class="logo-reel" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="17" stroke="#c9a84c" stroke-width="0.8" opacity="0.5"/>
        <circle cx="18" cy="18" r="12" stroke="#c9a84c" stroke-width="0.5" opacity="0.3"/>
        <circle cx="18" cy="18" r="3" fill="#c9a84c" opacity="0.6"/>
        <circle cx="18" cy="9" r="2.5" stroke="#c9a84c" stroke-width="0.7" opacity="0.5"/>
        <circle cx="25.6" cy="22.5" r="2.5" stroke="#c9a84c" stroke-width="0.7" opacity="0.5"/>
        <circle cx="10.4" cy="22.5" r="2.5" stroke="#c9a84c" stroke-width="0.7" opacity="0.5"/>
      </svg>
      <span class="site-name">Dead Set</span>
    </div>
    <span class="header-meta">Dispatch from the Lab &nbsp;·&nbsp; Edition 003</span>
    <div class="header-rule-bottom"></div>
  </div>

  <!-- SHOW HEADER -->
  <div class="show-header">
    <div class="show-number">A letter from the lab</div>
    <div class="show-title">Firsts &amp; Lasts</div>
    <div class="show-tagline">Wake. Now. Discover.</div>
    <div class="show-venue">
      Dead Set Lab &nbsp;·&nbsp; The Bay &nbsp;·&nbsp; Beta Season
    </div>
  </div>

  <!-- SET I — LETTER BODY -->
  <div class="letter-section">
    <div class="letter-eyebrow">Set I &nbsp;·&nbsp; Where we've been</div>

    <span class="letter-salutation">Hey Now —</span>

    <div class="letter-body">
      Short version: we've been quiet on the dispatch, loud in the workshop.
    </div>

    <div class="letter-body">
      A stretch of no letters from the lab doesn't mean nothing is happening. It usually means the opposite. Since the last dispatch we've been heads-down on the seams — the small stuff that makes the whole thing feel like <em>music</em> and not like <em>software</em>. Faster starts. Fewer weird moments. Cleaner paths between a friend, their shows, and yours. The kind of work that doesn't announce itself, but you feel it every time the needle drops.
    </div>

    <div class="letter-body">
      Two bigger things worth naming. <strong>The iOS app is close.</strong> The wrapping work is almost done and the App Store submission is next — Dead Set in your pocket, the way it was always meant to live. And there's a new move in Cosmic Charlie that I want to spend most of this letter on, because it didn't come from a spec doc. It came from you.
    </div>

    <div class="pull-quote">
      A good tool listens.<br>
      A great one changes when you talk back.
    </div>
  </div>

  <!-- SET II — FEATURE SPOTLIGHT -->
  <div class="feature-section">
    <div class="feature-eyebrow">Set II &nbsp;·&nbsp; Now live</div>
    <div class="feature-headline">Firsts &amp; Lasts</div>
    <div class="feature-subtitle">
      Every song has a first time it was ever played, and a last. <em>FTPs and LTPs</em> — the debuts and the swan songs. Ask Cosmic Charlie to build a setlist anchored around them and he'll pull the exact dates. Cassidy debuts, Fillmore West, 3/23/74. Row Jimmy's final airing, 7/9/95. Setlists that walk you through an arc, not just the highlights.
    </div>
    <a href="https://dead-set.org/builder?wizard=true" class="feature-cta">
      Ask Charlie for Firsts &amp; Lasts &nbsp;↗
    </a>
    <div class="feature-caption">
      Pick it as your priority in the wizard.<br>
      Or just tell him <a href="https://dead-set.org/builder?wizard=true">"give me all the debuts"</a>.
    </div>
  </div>

  <!-- DIVIDER -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-center"><span class="divider-glyph">⌁</span></div>
  </div>

  <!-- ENCORE — PHILLY BOB SHOUTOUT -->
  <div class="letter-section">
    <div class="letter-eyebrow">Encore &nbsp;·&nbsp; From the community</div>

    <div class="moment-card">
      <div class="moment-eyebrow">This one's from Philly Bob</div>
      <div class="moment-title">Firsts &amp; Lasts came from a Deadhead, not a spec sheet</div>
      <div class="moment-body">
        A Founding Deadhead going by <strong>Philly Bob</strong> messaged the other week: <em>"You should let Charlie work with FTPs and LTPs. That's where the story is."</em> He was right. It shipped a few days later.
      </div>
      <div class="moment-body">
        This is exactly how this thing gets better. You spot the missing move, tell me, and it lands in the app. The dispatches will always be a two-way street. If there's something you want Cosmic Charlie to do, or a shape of listening he's not catching yet, <a href="https://dead-set.org/backstage">tell me Backstage</a>.
      </div>
      <div class="moment-body" style="margin-bottom: 0;">
        Philly Bob — this one's for you. <em>Wake. Now. Discover.</em>
      </div>
    </div>
  </div>

  <!-- SIGN-OFF -->
  <div class="signoff-section">

    <div class="signoff-body">
      That's the letter. Quiet stretches are just recording sessions. Louder ones — like this — are how we let the tape roll.
    </div>

    <div class="signoff-body">
      Keep telling me what's broken. Keep telling me what you wish existed. Keep sending the shows that moved you. And <strong>keep finding each other.</strong> That's the whole thing.
    </div>

    <span class="signoff-closing">Gratefully,</span>
    <span class="signoff-name">grateful_jaguaro</span>
    <span class="signoff-title">Founder · Dead Set · dead-set.org</span>
  </div>

  <!-- BACKSTAGE -->
  <div class="backstage-box">
    <div class="backstage-badge">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-right:7px;">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="#0a0a0a" stroke-width="1.5" fill="none"/>
        <path d="M2 10h20" stroke="#0a0a0a" stroke-width="1.5"/>
        <path d="M7 15h4" stroke="#0a0a0a" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="backstage-badge-text">Backstage</span>
    </div>
    <div class="backstage-label">Add your voice</div>
    <div class="backstage-text">
      Backstage is where we build this together. Drop a wish, log a bug, or send me the show that's been living rent-free in your head. Every Founding Deadhead has an all-access pass.
    </div>
    <a href="https://dead-set.org/backstage" class="backstage-cta">Go Backstage &nbsp;↗</a>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-rule"></div>
    <div class="footer-logo">Dead Set · dead-set.org</div>
    <div class="footer-copy">
      Sent from grateful_jaguaro@dead-set.org<br>
      You're getting this because you're a Founding Deadhead.<br>
      Please copy and share freely &nbsp;·&nbsp; Trade only<br><br>
      <a href="#">Unsubscribe</a> &nbsp;·&nbsp; <a href="https://dead-set.org">Open Dead Set</a>
    </div>
  </div>

</div>

</body>
</html>
`;
