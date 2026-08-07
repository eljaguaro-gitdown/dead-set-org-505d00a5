# Dead Set

**Build the show. Press play. Pass it on.**

Dead Set is a free, non-commercial web + iOS app for building, sharing, and *listening to* dream Grateful Dead setlists. Reconstruct a night that never happened — or one that did — and hear it through fan-recorded tapes streaming from the [Internet Archive's Live Music Archive](https://archive.org/details/GratefulDead).

Live at **[dead-set.org](https://dead-set.org)**.

## The music

Every recording streams from the Internet Archive. Nothing is hosted here, and none of it would exist without the tapers, transferrers, uploaders, and traders who kept these shows alive for fifty years. Dead Set operates strictly non-commercially under the [Grateful Dead's digital-distribution policy](https://dead-set.org/about) — no ads, nothing for sale — and in accordance with [Archive.org's streaming policy](https://archive.org/post/261115/hotlinking-allowed). If you want to support something, [donate to the Internet Archive](https://archive.org/donate/).

Dead Set stands alongside — never in place of — [Relisten](https://relisten.net), [headyversion](https://headyversion.com), and the Archive itself.

## Stack

React 18 + TypeScript + Vite, Tailwind + shadcn/ui, Supabase (Postgres, Auth, Edge Functions), Capacitor for iOS. See [CLAUDE.md](CLAUDE.md) for the full architecture tour and conventions.

## Running it

```sh
bun install
bun run dev        # http://localhost:8080
```

You'll need a Supabase project and two env vars (see [.env.example](.env.example)). Tests: `bun run test`. More in [CLAUDE.md](CLAUDE.md).

## Contributing

We welcome contributions — see [CONTRIBUTING.md](CONTRIBUTING.md). Like our friends at Relisten, we keep a level of direction over the product's voice and vision (the grounding doc is [`dead-set-field-guide.md`](dead-set-field-guide.md)), but bugs, polish, and ideas are always wanted. Security issues: see [SECURITY.md](SECURITY.md).

## License

[AGPL-3.0](LICENSE) — the same license as Relisten. Run it, fork it, improve it; if you serve a modified version to others, share your changes.
