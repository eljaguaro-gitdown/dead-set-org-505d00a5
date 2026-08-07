# Security Policy

Dead Set stores real user data (accounts, setlists, messages) in Supabase, protected by Row-Level Security. We take reports seriously and appreciate responsible disclosure.

## Reporting a vulnerability

- **Preferred:** open a private report via GitHub Security Advisories on this repository ("Report a vulnerability").
- Please do not open public issues for security problems, and give us a reasonable window to fix before disclosure.

## Scope

- The web app at dead-set.org and this codebase
- Supabase RLS policies and edge functions in `supabase/`
- The iOS build

Out of scope: the Internet Archive's infrastructure (report to them), rate-limit/volume issues without a security impact, and social engineering.

## What to expect

We'll acknowledge within a few days, keep you posted on the fix, and credit you (if you'd like) once it ships.
