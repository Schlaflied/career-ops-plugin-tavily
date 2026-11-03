# career-ops-plugin-tavily

Tavily web search for career-ops — supplements ATS API scanning with web search results.

## Setup

Add `TAVILY_API_KEY=tvly-xxx` to your `.env`. Get a free key at https://tavily.com.

Optional settings in `config/plugins.yml`:
```yaml
tavily:
  role: "Instructional Designer"   # role to search for
  location: "Canada"               # location filter
  maxResults: 10                   # max results per search
  searchDepth: basic               # basic | advanced (advanced = 2x cost)
```

## Usage

```bash
node plugins.mjs skill tavily          # show this help
node plugins.mjs enable tavily --confirm
```

Once enabled, the `search` hook runs automatically during `node scan.mjs` to supplement ATS API results with web search.
