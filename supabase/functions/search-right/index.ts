const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RIGHT_DOMAINS = [
  'foxnews.com', 'nypost.com', 'wsj.com', 'washingtonexaminer.com', 'dailywire.com',
  'nationalreview.com', 'breitbart.com', 'newsmax.com', 'dailycaller.com', 'thefederalist.com',
  'washingtontimes.com', 'theblaze.com', 'foxbusiness.com', 'freebeacon.com', 'townhall.com',
];

const outletNames: Record<string, string> = {
  'foxnews.com': 'Fox News',
  'nypost.com': 'New York Post',
  'wsj.com': 'Wall Street Journal',
  'washingtonexaminer.com': 'Washington Examiner',
  'dailywire.com': 'Daily Wire',
  'nationalreview.com': 'National Review',
  'breitbart.com': 'Breitbart',
  'newsmax.com': 'Newsmax',
  'dailycaller.com': 'Daily Caller',
  'thefederalist.com': 'The Federalist',
  'washingtontimes.com': 'Washington Times',
  'theblaze.com': 'The Blaze',
  'foxbusiness.com': 'Fox Business',
  'freebeacon.com': 'Free Beacon',
  'townhall.com': 'Townhall',
};

interface Article {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  perspective: 'left' | 'center' | 'right';
  label: string;
}

function isAllowedDomain(url: string, domains: string[]): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return domains.some((d) => host === d.toLowerCase().replace(/^www\./, '') || host.endsWith('.' + d.toLowerCase().replace(/^www\./, '')));
  } catch {
    return false;
  }
}

function isArticlePath(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path === '/' || path === '') return false;
    if (path.startsWith('/people') || path.startsWith('/author')) return false;
    if (path.includes('/tag/') || path.includes('/category/')) return false;
    return path.length > 10;
  } catch {
    return false;
  }
}

function detectOutlet(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return outletNames[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
  } catch {
    return 'Unknown';
  }
}

function cleanText(text: string): string {
  return (text || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────
// Brave Search API
// ─────────────────────────────────────────────────────────────

async function searchBrave(topic: string): Promise<Article[]> {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
  if (!apiKey) {
    throw new Error('Brave Search API key not configured');
  }

  const topicClean = String(topic).replace(/["""]/g, '').trim();
  
  // Build query with site: operators for right-leaning sources
  const siteOperators = RIGHT_DOMAINS.slice(0, 5).map(d => `site:${d}`).join(' OR ');
  const fullQuery = `(${siteOperators}) ${topicClean}`;
  
  console.log(`[RIGHT] Searching Brave: ${fullQuery.slice(0, 100)}...`);

  const params = new URLSearchParams({
    q: fullQuery,
    count: '20',
    freshness: 'pw', // past week
    text_decorations: 'false',
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RIGHT] Brave Search error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Brave Search ${response.status}`);
  }

  const data = await response.json();
  const results = data.web?.results || [];
  console.log(`[RIGHT] Brave Search returned ${results.length} results`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';

    if (!url || !isAllowedDomain(url, RIGHT_DOMAINS) || !isArticlePath(url)) continue;

    const outlet = detectOutlet(url);
    const title = result.title || `Article from ${outlet}`;
    const snippet = result.description || title;

    articles.push({
      url,
      title: cleanText(title),
      outlet,
      snippet: cleanText(snippet),
      perspective: 'right',
      label: 'Right-Leaning Source',
    });
  }

  return articles;
}

// ─────────────────────────────────────────────────────────────
// Firecrawl fallback
// ─────────────────────────────────────────────────────────────

async function searchFirecrawl(topic: string): Promise<Article[]> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    throw new Error('Firecrawl API key not configured');
  }

  const siteQuery = RIGHT_DOMAINS.slice(0, 5).map(d => `site:${d}`).join(' OR ');
  const query = `${topic} (${siteQuery})`;

  console.log(`[RIGHT] Firecrawl fallback search: ${query.slice(0, 80)}...`);

  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: 15,
      lang: 'en',
      country: 'us',
      scrapeOptions: { formats: ['markdown'] },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RIGHT] Firecrawl error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Firecrawl ${response.status}`);
  }

  const data = await response.json();
  const results = data.data || [];
  console.log(`[RIGHT] Firecrawl returned ${results.length} results`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';

    if (!url || !isAllowedDomain(url, RIGHT_DOMAINS) || !isArticlePath(url)) continue;

    const outlet = detectOutlet(url);
    const title = result.title || `Article from ${outlet}`;
    const snippet = result.description || result.markdown?.slice(0, 200) || title;

    articles.push({
      url,
      title: cleanText(title),
      outlet,
      snippet: cleanText(snippet),
      perspective: 'right',
      label: 'Right-Leaning Source',
    });
  }

  return articles;
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();
    if (!topic) {
      return new Response(JSON.stringify({ success: false, error: 'Topic required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let articles: Article[] = [];
    let source = 'brave';

    // Try Brave Search first
    try {
      articles = await searchBrave(topic);
    } catch (braveError) {
      console.warn(`[RIGHT] Brave failed, trying Firecrawl fallback: ${braveError}`);
      source = 'firecrawl';
      try {
        articles = await searchFirecrawl(topic);
      } catch (firecrawlError) {
        console.error(`[RIGHT] Firecrawl fallback also failed: ${firecrawlError}`);
      }
    }

    console.log(`[RIGHT] Final result: ${articles.length} articles from ${source}`);

    return new Response(JSON.stringify({ success: true, articles, source }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[RIGHT] Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error), articles: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
