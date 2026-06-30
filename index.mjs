// career-ops-plugin-tavily
// Author: Schlaflied · https://github.com/Schlaflied
// License: MIT · https://github.com/Schlaflied/career-ops-plugin-tavily
//
// Tavily search/extract for job scanning, liveness checks, and company research.
// Reach the network only through ctx.fetch (engine enforces allowedHosts).

const TAVILY_SEARCH_URL  = 'https://api.tavily.com/search';
const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract';

const CLOSED_SIGNALS = [
  'no longer accepting', 'position has been filled', 'job has expired',
  'posting has closed', 'this job is closed', 'application period has ended',
  'we are not currently hiring', 'position is no longer available',
  '404', 'page not found', 'job not found',
];

const ACTIVE_SIGNALS = [
  'apply now', 'apply for this job', 'submit your application',
  'we are hiring', 'join our team', 'open position',
  'job description', 'responsibilities', 'qualifications',
];

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

async function tavilyExtract(ctx, urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  const res = await ctx.fetch(TAVILY_EXTRACT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ api_key: ctx.env.TAVILY_API_KEY, urls: list }),
  });
  if (!res.ok) throw new Error(`Tavily extract ${res.status}: ${await res.text()}`);
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
    if (host.includes('greenhouse.io')) return host.split('.')[0];
    if (host.includes('lever.co'))      return url.split('/')[3] || '';
    if (host.includes('ashbyhq.com'))   return url.split('/')[3] || '';
  } catch {}
  const m = title?.match(/(?:at|@)\s+([A-Z][^|–-]+)/);
  return m ? m[1].trim() : '';
}

function extractLocation(text) {
  const m = text.match(/\b(Toronto|Vancouver|Montreal|Ottawa|Calgary|Remote|Canada|Ontario|BC|Alberta)\b/i);
  return m ? m[1] : '';
}

export default {
  async search(ctx) {
    const role     = ctx.settings?.role     || 'Instructional Designer';
    const location = ctx.settings?.location || 'Canada';
    const query = `"${role}" jobs site:linkedin.com OR site:greenhouse.io OR site:lever.co OR site:ashbyhq.com ${location}`;
    const data  = await tavilySearch(ctx, query, { maxResults: ctx.settings?.maxResults || 10 });
    return parseJobs(data.results);
  },

  async checkLiveness(ctx, url) {
    try {
      const result = await tavilyExtract(ctx, url);
      const page   = result.results?.[0];
      if (!page) return 'unknown';
      const text = (page.raw_content || page.content || '').toLowerCase();
      if (!text) return 'unknown';
      if (CLOSED_SIGNALS.some(s => text.includes(s))) return 'closed';
      if (ACTIVE_SIGNALS.some(s => text.includes(s)))  return 'active';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  },

  async researchCompany(ctx, company, role = '') {
    const query = role
      ? `"${company}" ${role} company culture glassdoor reviews`
      : `"${company}" company overview culture hiring`;
    return tavilySearch(ctx, query, { searchDepth: 'advanced', maxResults: 8, includeAnswer: true });
  },
};
