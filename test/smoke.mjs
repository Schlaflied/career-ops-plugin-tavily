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

// 3. checkLiveness returns expected values
console.log('\n3. checkLiveness');
const closedCtx = mockCtx({ results: [{ raw_content: 'this position is no longer available', url: 'https://example.com' }] });
const activeCtx = mockCtx({ results: [{ raw_content: 'apply now for this open position', url: 'https://example.com' }] });
const emptyCtx  = mockCtx({ results: [] });

assert(await plugin.checkLiveness(closedCtx, 'https://example.com') === 'closed',  'closed signal → closed');
assert(await plugin.checkLiveness(activeCtx, 'https://example.com') === 'active',  'active signal → active');
assert(await plugin.checkLiveness(emptyCtx,  'https://example.com') === 'unknown', 'no results → unknown');

// 4. env handling
console.log('\n4. env handling');
const noKeyCtx = mockCtx({}, { env: {} });
assert(typeof noKeyCtx.settings === 'object', 'ctx.settings is object');

console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
