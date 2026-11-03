// Smoke test — verifies plugin contract without hitting the real API
import plugin from '../index.mjs';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { console.log(`  ✅ ${msg}`); passed++; }
  else           { console.error(`  ❌ ${msg}`); failed++; }
}

// Mock ctx that intercepts http calls without using global fetch
function mockCtx(responseBody, { env = {}, settings = {} } = {}) {
  const calls = [];
  const httpStub = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok:   true,
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
    };
  };
  return {
    env:      { TAVILY_API_KEY: 'tvly-test', ...env },
    settings: { ...settings },
    fetch: httpStub,
    calls,
  };
}

console.log('career-ops-plugin-tavily smoke test\n');

// 1. Plugin exports default with search hook
console.log('1. Plugin shape');
assert(typeof plugin === 'object',          'default export is object');
assert(typeof plugin.search === 'function', 'exports search hook');

// 2. search hook returns Job[]
console.log('\n2. search hook');
const fakeSearchResponse = {
  results: [
    { title: 'Instructional Designer at Acme',  url: 'https://boards.greenhouse.io/acme/jobs/123', content: 'Toronto Ontario' },
    { title: 'Learning Designer at Beta Corp',  url: 'https://lever.co/beta/abc',                 content: 'Remote Canada' },
    { title: 'No URL entry',                    url: '',                                           content: '' },
  ],
};
const ctx = mockCtx(fakeSearchResponse);
const jobs = await plugin.search('senior search engineer', ctx);
assert(Array.isArray(jobs),            'returns array');
assert(jobs.length === 2,              'filters out entries with no url (got ' + jobs.length + ')');
assert(jobs[0].title  !== undefined,   'job has title');
assert(jobs[0].url    !== undefined,   'job has url');
assert(jobs[0].company !== undefined,  'job has company');
assert(jobs[0].location !== undefined, 'job has location');
assert(JSON.parse(ctx.calls[0].opts.body).query === 'senior search engineer', 'uses the engine-supplied query');

const fallbackCtx = mockCtx(fakeSearchResponse, { settings: { role: 'Learning Designer', location: 'Remote' } });
await plugin.search('', fallbackCtx);
assert(JSON.parse(fallbackCtx.calls[0].opts.body).query === 'Learning Designer Remote jobs', 'falls back to configured role and location');

const neutralCtx = mockCtx(fakeSearchResponse);
await plugin.search('', neutralCtx);
assert(JSON.parse(neutralCtx.calls[0].opts.body).query === 'jobs', 'uses a neutral fallback when settings are empty');

// 3. regression: company, location, and hook surface (reported on #1344)
console.log('\n3. company / location / hook surface');
const ghCtx = mockCtx({ results: [
  { title: 'Engineer at Postman', url: 'https://job-boards.greenhouse.io/postman/jobs/123', content: 'Location: Bengaluru, India' },
  { title: 'Engineer at Acme',    url: 'https://boards.greenhouse.io/acme/jobs/9',          content: 'Toronto, ON hybrid' },
  { title: 'Engineer at Gamma',   url: 'https://example.com/gamma',                         content: 'Based in Berlin, Germany' },
  { title: 'Engineer at Beta',    url: 'https://jobs.lever.co/beta/abc',                    content: 'Remote Canada' },
] });
const gh = await plugin.search('engineer', ghCtx);
assert(gh[0].company === 'postman', 'Greenhouse job-boards host -> company from first path segment');
assert(gh[1].company === 'acme',    'Greenhouse boards host -> company from first path segment');
assert(gh[3].company === 'beta',    'Lever company still read from the path');
assert(gh[0].location === 'Bengaluru, India', 'labelled non-Canadian location is kept');
assert(gh[1].location === 'Toronto, ON',      'City, province code is kept');
assert(gh[2].location === 'Berlin, Germany',  'City, Country is kept');
assert(gh[3].location === 'Remote',           'Remote still recognised');
assert(Object.keys(plugin).join() === 'search', 'only the declared search hook is exported');

// 4. env handling
console.log('\n4. env handling');
const noKeyCtx = mockCtx({}, { env: {} });
assert(typeof noKeyCtx.settings === 'object', 'ctx.settings is object');

console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
