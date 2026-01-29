const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// AllSides-aligned Right & Lean Right sources
const RIGHT_DOMAINS = [
  'foxnews.com', 'nypost.com', 'breitbart.com', 'newsmax.com', 'oann.com',
  'dailywire.com', 'thefederalist.com', 'dailycaller.com', 'theblaze.com', 'infowars.com',
  'townhall.com', 'pjmedia.com', 'hotair.com', 'redstate.com', 'thegatewaypundit.com',
  'wsj.com', 'washingtonexaminer.com', 'nationalreview.com', 'washingtontimes.com',
  'freebeacon.com', 'foxbusiness.com', 'reason.com', 'spectator.org', 'americanthinker.com',
  'theepochtimes.com', 'justthenews.com', 'dailymail.co.uk', 'nypost.com',
  'heritage.org', 'aei.org', 'cato.org',
];

const outletNames: Record<string, string> = {
  'foxnews.com': 'Fox News',
  'nypost.com': 'New York Post',
  'breitbart.com': 'Breitbart',
  'newsmax.com': 'Newsmax',
  'oann.com': 'OANN',
  'dailywire.com': 'Daily Wire',
  'thefederalist.com': 'The Federalist',
  'dailycaller.com': 'Daily Caller',
  'theblaze.com': 'The Blaze',
  'infowars.com': 'InfoWars',
  'townhall.com': 'Townhall',
  'pjmedia.com': 'PJ Media',
  'hotair.com': 'Hot Air',
  'redstate.com': 'RedState',
  'thegatewaypundit.com': 'Gateway Pundit',
  'wsj.com': 'Wall Street Journal',
  'washingtonexaminer.com': 'Washington Examiner',
  'nationalreview.com': 'National Review',
  'washingtontimes.com': 'Washington Times',
  'freebeacon.com': 'Free Beacon',
  'foxbusiness.com': 'Fox Business',
  'reason.com': 'Reason',
  'spectator.org': 'The American Spectator',
  'americanthinker.com': 'American Thinker',
  'theepochtimes.com': 'The Epoch Times',
  'justthenews.com': 'Just The News',
  'dailymail.co.uk': 'Daily Mail',
  'heritage.org': 'Heritage Foundation',
  'aei.org': 'AEI',
  'cato.org': 'Cato Institute',
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
// Brave Search API - search broadly, filter to right sources
// ─────────────────────────────────────────────────────────────

async function searchBrave(topic: string): Promise<Article[]> {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
  if (!apiKey) {
    throw new Error('Brave Search API key not configured');
  }

  const topicClean = String(topic).replace(/["""]/g, '').trim();
  
  // Search broadly for news, then filter results to right-leaning sources
  const fullQuery = `${topicClean} news`;
  
  console.log(`[RIGHT] Searching Brave broadly: "${fullQuery}"`);

  const params = new URLSearchParams({
    q: fullQuery,
    count: '50',
    freshness: 'pw',
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
  console.log(`[RIGHT] Brave returned ${results.length} total results, filtering to right sources...`);

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

  console.log(`[RIGHT] Found ${articles.length} articles from right-leaning sources`);
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

  const query = `${topic} news`;

  console.log(`[RIGHT] Firecrawl fallback: "${query}"`);

  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: 30,
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
  console.log(`[RIGHT] Firecrawl returned ${results.length} results, filtering...`);

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
