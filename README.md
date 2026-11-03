# career-ops-plugin-tavily

A [career-ops](https://github.com/santifer/career-ops) community plugin — Tavily web search for job scanning.

## What it does

Supplements career-ops' zero-token ATS API scanning with web search via the [Tavily API](https://tavily.com):

- **`search` hook** — finds job postings across LinkedIn, Greenhouse, Lever, and Ashby via web search; results feed into the career-ops pipeline exactly like ATS scanner results

The plugin declares and implements one hook, `search`. Earlier versions also exported `checkLiveness` and `researchCompany`, but career-ops only calls the hooks named in the manifest (`provider`, `ingest`, `search`, `notify`, `export`), so they were never invoked; they were removed in v0.1.2 rather than advertised.

## Setup

1. Install: `node plugins.mjs add tavily`
2. Add to `.env`: `TAVILY_API_KEY=tvly-xxx`
3. Enable: `node plugins.mjs enable tavily --confirm`

Get a free Tavily API key at https://tavily.com.

Optional settings in `config/plugins.yml`:
```yaml
tavily:
  role: "Instructional Designer"
  location: "Canada"
  maxResults: 10
  searchDepth: basic        # basic | advanced (advanced = 2x cost)
```

## Author

[Schlaflied](https://github.com/Schlaflied)

## License

MIT
