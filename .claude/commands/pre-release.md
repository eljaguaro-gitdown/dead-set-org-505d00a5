---
description: Mandatory QA gate before any Lovable publish (qa-release agent)
---

Use the qa-release subagent to run the full pre-release checklist against the current state of main on eljaguaro-gitdown/dead-set-org-505d00a5.

Spawn one verifier per checklist item. Verify in a real browser at mobile viewport where possible. Do not skip the Lovable sync check (get_diff with sha + base_sha, or list_edits — never read_file with a ref).

Return the single verdict block: PASS / BLOCK / PASS WITH NOTES with evidence. I will not publish on a BLOCK, and neither should any session.

Release context (optional — what changed): $ARGUMENTS
