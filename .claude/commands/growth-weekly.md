---
description: Run the weekly Dead Set growth review (growth-analyst agent)
---

Use the growth-analyst subagent to run the weekly growth review.

Data: PostHog only, for traffic as well as the funnel — apply the external-traffic filter from the agent definition (production host, internal cohort and bots excluded). Do not read traffic from Supabase `page_visits`. Have the agent confirm PostHog access by calling it first; if it has none, it reports that instead of producing numbers.

Scope: full 15-event activation funnel, week-over-week, with standing focus on landing→builder conversion and the /setlist/:id share loop. Fan out per funnel segment, segment mobile/desktop and new/returning, check git log for releases in the window, and write the report to reports/growth/.

Return to me only: the funnel summary table, what moved (with segments), and this week's ONE recommended experiment. If last week's experiment is still running, report its status before proposing a new one.

Additional focus this week (optional): $ARGUMENTS
