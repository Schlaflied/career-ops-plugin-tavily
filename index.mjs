// career-ops-plugin-tavily
// Author: Schlaflied · https://github.com/Schlaflied
// License: MIT · https://github.com/Schlaflied/career-ops-plugin-tavily
//
// Tavily web search for job scanning (the `search` hook).
// Reach the network only through ctx.fetch (engine enforces allowedHosts).

const TAVILY_SEARCH_URL  = 'https://api.tavily.com/search';

async function tavilySearch(ctx, query, opts = {}) {
  const body = {
    api_key:             ctx.env.TAVILY_API_KEY,
    query,
    search_depth:        opts.searchDepth || ctx.settings?.searchDepth || 'basic',
    max_results:         opts.maxResults  || ctx.settings?.maxResults  || 5,
    include_answer:      opts.includeAnswer  ?? false,
    include_raw_content: opts.includeContent ?? false,
  };
  if (opts.includeDomains?.length) body.include_domains = opts.includeDomains;
  if (opts.excludeDomains?.length) body.exclude_domains = opts.excludeDomains;

  const res = await ctx.fetch(TAVILY_SEARCH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tavily search ${res.status}: ${await res.text()}`);
  return res.json();
}

function parseJobs(results) {
  return (results || []).map(r => ({
    title:    r.title   || '',
    url:      r.url     || '',
    company:  extractCompany(r.url, r.title),
    location: extractLocation(r.content || r.title || ''),
  })).filter(j => j.url);
}

function extractCompany(url, title) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (host.includes('greenhouse.io')) return url.split('/')[3] || '';
    if (host.includes('lever.co'))      return url.split('/')[3] || '';
    if (host.includes('ashbyhq.com'))   return url.split('/')[3] || '';
  } catch {}
  const m = title?.match(/(?:at|@)\s+([A-Z][^|–-]+)/);
  return m ? m[1].trim() : '';
}

// "City, XX" (province/state code) or "City, Country"; country list is a convenience, not exhaustive.
const CITY_REGION_RE = /\b([A-Z][\p{L}.'-]+(?: [A-Z][\p{L}.'-]+){0,2}),\s*([A-Z]{2}|India|Canada|United States|USA|United Kingdom|UK|Germany|France|Australia|Singapore|Ireland|Netherlands|Brazil|Mexico|Spain|Poland|Japan)\b/u;

function extractLocation(text) {
  const labelled = text.match(/\blocation:\s*([^\n|;]{2,60})/i);
  if (labelled) return labelled[1].trim();
  const cityRegion = text.match(CITY_REGION_RE);
  if (cityRegion) return `${cityRegion[1]}, ${cityRegion[2]}`;
  const m = text.match(/\b(Toronto|Vancouver|Montreal|Ottawa|Calgary|Remote|Canada|Ontario|BC|Alberta)\b/i);
  return m ? m[1] : '';
}

export default {
  async search(query, ctx) {
    const suppliedQuery = typeof query === 'string' ? query.trim() : '';
    const role = typeof ctx.settings?.role === 'string' ? ctx.settings.role.trim() : '';
    const location = typeof ctx.settings?.location === 'string' ? ctx.settings.location.trim() : '';
    const searchText = suppliedQuery || [role, location, 'jobs'].filter(Boolean).join(' ');
    const data = await tavilySearch(ctx, searchText, { maxResults: ctx.settings?.maxResults || 10 });
    return parseJobs(data.results);
  },
};
