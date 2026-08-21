// Dispatch 004 -- "The Merriweather Shakedown" campaign letter.
// First dispatch on the Deadhead Archives system (velvet maroon +
// parchment) rather than the old near-black shell. CTA targets the
// Songbook Issue 001. Raw HTML inline, same pattern as dispatch_003.

export const DISPATCH_004_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Dead Set · The Merriweather Shakedown</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Sancreek&family=Special+Elite&family=Caveat:wght@400;700&family=DM+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

  /* Deadhead Archives palette — DESIGN.md §Palette. Velvet maroon ground,
     parchment objects floating on it. Never flat grey, never near-black. */
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background-color:#4A0404;
    font-family:'DM Sans', Arial, Helvetica, sans-serif;
    color:#F5E9D3; -webkit-font-smoothing:antialiased;
  }
  a { color:#C28E33; }
  img { border:0; outline:none; }

  .wrap { max-width:620px; margin:0 auto; background-color:#4A0404; }

  /* ── MASTHEAD — on the maroon ground, per constraint 1 ── */
  .mast { padding:34px 40px 30px; text-align:center; }
  .stamp {
    width:64px; height:64px; margin:0 auto 18px;
    border:2px solid #C28E33; border-radius:50%;
    line-height:60px; text-align:center;
    font-family:'IBM Plex Mono', Courier, monospace; font-size:9px;
    letter-spacing:.2em; color:#C28E33;
  }
  .wordmark {
    font-family:'UnifrakturMaguntia', Georgia, 'Times New Roman', serif;
    font-size:42px; color:#F5E9D3; line-height:1.1; letter-spacing:.02em;
  }
  .url {
    display:block; margin-top:12px;
    font-family:'Special Elite', 'Courier New', monospace; font-size:12px;
    letter-spacing:.3em; text-transform:uppercase; color:#C28E33;
  }
  .tagline {
    display:block; margin-top:16px;
    font-family:'Sancreek', Georgia, serif; font-size:15px;
    color:rgba(245,233,211,.75); letter-spacing:.08em;
  }
  .mast-perf { height:0; border-top:2px dashed rgba(194,142,51,.45); margin-top:26px; }
  .dateline {
    padding:14px 40px 22px; text-align:center;
    font-family:'Special Elite', 'Courier New', monospace; font-size:10px;
    letter-spacing:.18em; text-transform:uppercase; color:rgba(245,233,211,.55);
  }

  /* ── THE PARCHMENT SHEET — the floating object ── */
  .sheet { background-color:#F5E9D3; color:#241F1A; padding:36px 40px 30px; }
  .hey { font-family:'Caveat', 'Segoe Script', cursive; font-size:34px; color:#C25238; margin-bottom:14px; }
  p.t { font-size:16px; line-height:1.72; color:#57503F; margin-bottom:18px; }
  p.t strong { color:#241F1A; font-weight:500; }

  .pull { margin:26px 0; padding:20px 22px; background-color:#EFE0C4; border-left:3px solid #C25238; }
  .pull q {
    display:block; quotes:none;
    font-family:'Sancreek', Georgia, serif; font-size:20px; line-height:1.5; color:#241F1A;
  }
  .pull cite {
    display:block; margin-top:14px; font-style:normal;
    font-family:'Special Elite', 'Courier New', monospace; font-size:10px;
    letter-spacing:.14em; text-transform:uppercase; color:#857B69;
  }

  /* ── SET DIVIDERS — perforated tear-offs, never a plain rule ── */
  .set { margin:34px 0 16px; }
  .set-label {
    font-family:'Special Elite', 'Courier New', monospace; font-size:10px;
    letter-spacing:.28em; text-transform:uppercase; color:#C25238; padding-bottom:10px;
  }
  .set-perf { height:0; border-top:2px dashed rgba(194,82,56,.45); }
  .set-title { font-family:'Sancreek', Georgia, serif; font-size:25px; color:#241F1A; margin:18px 0 12px; line-height:1.2; }

  /* ── STAT STRIP ── */
  .stats { width:100%; border-collapse:collapse; margin:22px 0 6px; }
  .stats td { width:33.33%; padding:16px 8px; text-align:center; background-color:#EFE0C4; border:1px solid #AF9B78; }
  .stat-n { font-family:'Sancreek', Georgia, serif; font-size:27px; color:#C25238; line-height:1; }
  .stat-l {
    display:block; margin-top:8px;
    font-family:'Special Elite', 'Courier New', monospace; font-size:9px;
    letter-spacing:.11em; text-transform:uppercase; color:#857B69; line-height:1.55;
  }

  /* ── BOOKENDS ── */
  .ends { width:100%; border-collapse:collapse; margin:20px 0; background-color:#EFE0C4; border:1px solid #AF9B78; }
  .ends td { padding:18px 20px; vertical-align:top; width:50%; }
  .ends td.r { border-left:2px dashed rgba(194,82,56,.45); }
  .end-l { font-family:'Special Elite', 'Courier New', monospace; font-size:9px; letter-spacing:.15em; text-transform:uppercase; color:#C28E33; }
  .end-d { font-family:'Caveat', cursive; font-size:28px; color:#3B6299; line-height:1.15; margin:4px 0 2px; }
  .end-v { font-family:'Special Elite', 'Courier New', monospace; font-size:10px; color:#857B69; line-height:1.6; }

  /* ── SLEEPER TEAR-OFF ROWS ── */
  .sleep { width:100%; border-collapse:collapse; margin:18px 0 6px; }
  .sleep td { padding:14px 4px; border-bottom:2px dashed rgba(175,155,120,.5); vertical-align:top; }
  .sleep tr:last-child td { border-bottom:0; }
  .s-date { font-family:'Caveat', cursive; font-size:24px; color:#3B6299; line-height:1.1; }
  .s-venue { font-family:'Special Elite', 'Courier New', monospace; font-size:10px; color:#857B69; display:block; margin-top:2px; }
  .s-why { font-size:14px; line-height:1.6; color:#57503F; display:block; margin-top:7px; }
  .s-votes {
    font-family:'IBM Plex Mono', Courier, monospace; font-size:12px;
    color:#857B69; text-align:right; white-space:nowrap; padding-left:10px;
  }

  /* ── CTA — foil gradient, DESIGN.md §3 ── */
  .cta-wrap { text-align:center; padding:14px 0 4px; }
  .cta {
    display:inline-block; padding:16px 34px;
    background:#C28E33;
    background-image:linear-gradient(135deg,#d4af37,#f3e5ab,#b8860b);
    color:#2A1206 !important; text-decoration:none;
    font-family:'Special Elite', 'Courier New', monospace; font-size:13px;
    letter-spacing:.14em; text-transform:uppercase;
  }
  .cta-sub {
    display:block; margin-top:12px;
    font-family:'Special Elite', 'Courier New', monospace; font-size:10px;
    letter-spacing:.1em; text-transform:uppercase; color:#857B69;
  }

  /* ── BACKSTAGE ── */
  .backstage { margin:30px 0 8px; padding:22px; background-color:#EFE0C4; border:2px dashed rgba(194,82,56,.45); }
  .backstage .set-label { padding-bottom:8px; }
  .backstage p { font-size:14px; line-height:1.7; color:#57503F; margin-bottom:12px; }
  .backstage a { font-family:'Special Elite', 'Courier New', monospace; font-size:11px; letter-spacing:.08em; color:#C25238; }

  /* ── ARCHIVE CREDIT ── */
  .credit { margin:26px 0 6px; padding:22px; text-align:center; border-top:2px dashed rgba(175,155,120,.55); border-bottom:2px dashed rgba(175,155,120,.55); }
  .credit p {
    font-family:'Special Elite', 'Courier New', monospace; font-size:10px;
    letter-spacing:.09em; line-height:2; color:#857B69; text-transform:uppercase;
  }
  .credit strong { color:#C25238; font-weight:400; }

  /* ── SIGN-OFF ── */
  .signoff { padding:24px 0 6px; }
  .signoff .sig { font-family:'Caveat', cursive; font-size:30px; color:#C25238; }
  .signoff .sig-sub {
    display:block; margin-top:4px;
    font-family:'Special Elite', 'Courier New', monospace; font-size:10px;
    letter-spacing:.13em; text-transform:uppercase; color:#857B69;
  }

  /* ── FOOTER — back out on the maroon ground ── */
  .footer { padding:28px 40px 34px; text-align:center; }
  .footer-logo {
    font-family:'UnifrakturMaguntia', Georgia, serif; font-size:20px;
    color:rgba(245,233,211,.85); margin-bottom:10px;
  }
  .footer-copy {
    font-family:'Special Elite', 'Courier New', monospace; font-size:10px;
    color:rgba(245,233,211,.55); letter-spacing:.09em; text-transform:uppercase; line-height:2;
  }
  .footer-copy a { color:#C28E33; text-decoration:underline; }

  .preheader { display:none !important; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all; }

  @media only screen and (max-width:620px) {
    .mast, .sheet, .footer, .dateline { padding-left:22px !important; padding-right:22px !important; }
    .wordmark { font-size:32px !important; }
    .stats td { display:block; width:100% !important; border-bottom:0; }
    .stats td:last-child { border-bottom:1px solid #AF9B78; }
    .ends td { display:block; width:100% !important; }
    .ends td.r { border-left:0; border-top:2px dashed rgba(194,82,56,.45); }
    .s-votes { display:none; }
  }
</style>
</head>
<body>

<span class="preheader">163 times played across seventeen years. Nine of them almost nobody has heard.</span>

<div class="wrap">

  <!-- MASTHEAD -->
  <div class="mast">
    <div class="stamp">REEL</div>
    <div class="wordmark">Dead&nbsp;Set</div>
    <span class="url">dead-set.org</span>
    <span class="tagline">Wake. Now. Discover.</span>
    <div class="mast-perf"></div>
  </div>

  <div class="dateline">Dispatch 004 &nbsp;·&nbsp; August 21, 2026 &nbsp;·&nbsp; grateful_jaguaro</div>

  <!-- THE SHEET -->
  <div class="sheet">

    <div class="hey">Hey Now,</div>

    <p class="t">
      Yesterday Rhino put the <strong>June 30, 1985 Shakedown Street</strong> out into the world on its own.
      Fifteen minutes, opening Set II at Merriweather Post Pavilion. If you were there you already knew.
      If you weren't, somebody has told you about it.
    </p>

    <div class="pull">
      <q>It's often described with well-deserved hyperbole; it's really that great.</q>
      <cite>David Lemieux · Grateful Dead legacy manager &amp; archivist</cite>
    </div>

    <p class="t">
      He also called it one of the greatest single performances of any song the band ever played. Forty years
      of heads had already reached that verdict on their own — it sits at the top of every list anyone has
      ever taken a vote on.
    </p>

    <!-- SET I -->
    <div class="set">
      <div class="set-label">Set I &nbsp;—&nbsp; The one everybody names</div>
      <div class="set-perf"></div>
    </div>

    <table class="stats" role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td><span class="stat-n">15</span><span class="stat-l">minutes,<br>opening Set II</span></td>
        <td><span class="stat-n">181</span><span class="stat-l">votes — first<br>of every version</span></td>
        <td><span class="stat-n">Sep 18</span><span class="stat-l">Summer Magic 1985<br>20-CD box lands</span></td>
      </tr>
    </table>

    <p class="t">
      Out now as a single. The full night arrives with the box next month. Go get it — this letter isn't
      about talking you into that.
    </p>

    <!-- SET II -->
    <div class="set">
      <div class="set-label">Set II &nbsp;—&nbsp; The other nine</div>
      <div class="set-perf"></div>
    </div>

    <div class="set-title">One night is a moment. Seventeen years is a life.</div>

    <p class="t">
      Shakedown Street was played <strong>163 times</strong>. The first and the last are worth sitting with
      for a second:
    </p>

    <table class="ends" role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span class="end-l">First played &nbsp;(FTP)</span>
          <div class="end-d">Aug 31, 1978</div>
          <span class="end-v">Red Rocks Amphitheatre<br>Morrison, CO</span>
        </td>
        <td class="r">
          <span class="end-l">Last played &nbsp;(LTP)</span>
          <div class="end-d">July 9, 1995</div>
          <span class="end-v">Soldier Field, Chicago<br>the last night the band played</span>
        </td>
      </tr>
    </table>

    <p class="t">
      At Soldier Field it opened Set II — the same slot it took at Merriweather ten years earlier. The song's
      last day was the band's last day. Nobody planned that.
    </p>

    <p class="t">
      In between are nine versions we've come to call <strong>sleepers</strong>. Enough heads voted them onto
      the all-time list that they aren't random picks — but they poll under a third of Merriweather's count.
      Real regard. Almost no attention. Four of them:
    </p>

    <table class="sleep" role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span class="s-date">Oct 25, 1979</span>
          <span class="s-venue">New Haven Coliseum · New Haven, CT</span>
          <span class="s-why">Phil drives the opening; the vocals dissolve into a Brent-and-Jerry funk excursion. The only version that seriously rivals Merriweather.</span>
        </td>
        <td class="s-votes">168</td>
      </tr>
      <tr>
        <td>
          <span class="s-date">May 16, 1981</span>
          <span class="s-venue">Barton Hall, Cornell · Ithaca, NY</span>
          <span class="s-why">The <em>other</em> Barton Hall show. Opens Set II and has spent forty years buried under 5/8/77.</span>
        </td>
        <td class="s-votes">42</td>
      </tr>
      <tr>
        <td>
          <span class="s-date">Mar 28, 1981</span>
          <span class="s-venue">Grugahalle · Essen, West Germany</span>
          <span class="s-why">A European Shakedown almost nobody goes looking for. Different room, different band.</span>
        </td>
        <td class="s-votes">39</td>
      </tr>
      <tr>
        <td>
          <span class="s-date">Sept 10, 1991</span>
          <span class="s-venue">Madison Square Garden · New York, NY</span>
          <span class="s-why">Tops its whole era on 48 votes — fewer than versions that don't even lead theirs. The Vince years are almost entirely unmapped.</span>
        </td>
        <td class="s-votes">48</td>
      </tr>
    </table>

    <p class="t">
      We laid all fifteen ranked versions out by era in the first issue of <strong>The Songbook</strong> —
      a new song every week, followed across all thirty years. Shakedown Street is where the series starts.
    </p>

    <div class="cta-wrap">
      <a class="cta" href="https://dead-set.org/songbook/shakedown-street">Read Issue 001 &amp; hear all 15</a>
      <span class="cta-sub">Free · no account needed to look</span>
    </div>

    <!-- ENCORE -->
    <div class="set">
      <div class="set-label">Encore &nbsp;—&nbsp; Backstage</div>
      <div class="set-perf"></div>
    </div>

    <div class="backstage">
      <div class="set-label">dead-set.org/backstage</div>
      <p>
        The wish list, the bug log, and the place to share your set. If a version belongs on that
        sleeper list and we missed it, put it in — that's how the list gets right.
      </p>
      <a href="https://dead-set.org/backstage">Go backstage &rarr;</a>
    </div>

    <div class="credit">
      <p>
        None of this exists without the <strong>tapers</strong>, the <strong>traders</strong>,<br>
        and the <strong>Internet Archive</strong>.<br>
        Forty years of people pointing a microphone at a stage<br>
        and handing the reel to a stranger.
      </p>
    </div>

    <div class="signoff">
      <div class="sig">See you on Shakedown Street,</div>
      <span class="sig-sub">grateful_jaguaro</span>
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-logo">Dead&nbsp;Set</div>
    <div class="footer-copy">
      dead-set.org &nbsp;·&nbsp; sent from grateful_jaguaro@dead-set.org<br>
      You're getting this because you're a Founding Deadhead.<br>
      Please copy and share freely &nbsp;·&nbsp; Trade only<br><br>
      <a href="{{unsubscribe_url}}">Unsubscribe</a> &nbsp;·&nbsp; <a href="https://dead-set.org">Open Dead Set</a>
    </div>
  </div>

</div>

</body>
</html>
`;
