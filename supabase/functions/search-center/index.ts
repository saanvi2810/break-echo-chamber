const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// AllSides-aligned Center sources
const CENTER_DOMAINS = [
  'reuters.com', 'apnews.com', 'bbc.com', 'c-span.org', 'allsides.com',
  'thehill.com', 'axios.com', 'realclearpolitics.com', 'thefactcheck.org',
  'csmonitor.com', 'pbs.org', 'usatoday.com', 'newsweek.com', 'forbes.com',
  'marketwatch.com', 'npr.org', 'abcnews.go.com', 'cbsnews.com',
  'politifact.com', 'snopes.com', 'factcheck.org',
  'aljazeera.com', 'france24.com', 'dw.com', 'scmp.com',
  'economist.com', 'ft.com', 'barrons.com',
];

const outletNames: Record<string, string> = {
  'reuters.com': 'Reuters',
  'apnews.com': 'AP News',
  'bbc.com': 'BBC',
  'c-span.org': 'C-SPAN',
  'allsides.com': 'AllSides',
  'thehill.com': 'The Hill',
  'axios.com': 'Axios',
  'realclearpolitics.com': 'RealClearPolitics',
  'thefactcheck.org': 'FactCheck.org',
  'csmonitor.com': 'Christian Science Monitor',
  'pbs.org': 'PBS',
  'usatoday.com': 'USA Today',
  'newsweek.com': 'Newsweek',
  'forbes.com': 'Forbes',
  'marketwatch.com': 'MarketWatch',
  'npr.org': 'NPR',
  'abcnews.go.com': 'ABC News',
  'cbsnews.com': 'CBS News',
  'politifact.com': 'PolitiFact',
  'snopes.com': 'Snopes',
  'factcheck.org': 'FactCheck.org',
  'aljazeera.com': 'Al Jazeera',
  'france24.com': 'France 24',
  'dw.com': 'DW News',
  'scmp.com': 'South China Morning Post',
  'economist.com': 'The Economist',
  'ft.com': 'Financial Times',
  'barrons.com': "Barron's",
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
// Brave Search API - search broadly, filter to center sources
// ─────────────────────────────────────────────────────────────

async function searchBrave(topic: string): Promise<Article[]> {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
  if (!apiKey) {
    throw new Error('Brave Search API key not configured');
  }

  const topicClean = String(topic).replace(/["""]/g, '').trim();
  
  // Search broadly for news, then filter results to center sources
  const fullQuery = `${topicClean} news`;
  
  console.log(`[CENTER] Searching Brave broadly: "${fullQuery}"`);

  const params = new URLSearchParams({
    q: fullQuery,
    // Brave's API can be picky about params; keep this conservative.
    count: '20',
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
    console.error(`[CENTER] Brave Search error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Brave Search ${response.status}`);
  }

  const data = await response.json();
  const results = data.web?.results || [];
  console.log(`[CENTER] Brave returned ${results.length} total results, filtering to center sources...`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';

    if (!url || !isAllowedDomain(url, CENTER_DOMAINS) || !isArticlePath(url)) continue;

    const outlet = detectOutlet(url);
    const title = result.title || `Article from ${outlet}`;
    const snippet = result.description || title;

    articles.push({
      url,
      title: cleanText(title),
      outlet,
      snippet: cleanText(snippet),
      perspective: 'center',
      label: 'Center Source',
    });
  }

  console.log(`[CENTER] Found ${articles.length} articles from center sources`);
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

  console.log(`[CENTER] Firecrawl fallback: "${query}"`);

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
    console.error(`[CENTER] Firecrawl error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Firecrawl ${response.status}`);
  }

  const data = await response.json();
  const results = data.data || [];
  console.log(`[CENTER] Firecrawl returned ${results.length} results, filtering...`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';

    if (!url || !isAllowedDomain(url, CENTER_DOMAINS) || !isArticlePath(url)) continue;

    const outlet = detectOutlet(url);
    const title = result.title || `Article from ${outlet}`;
    const snippet = result.description || result.markdown?.slice(0, 200) || title;

    articles.push({
      url,
      title: cleanText(title),
      outlet,
      snippet: cleanText(snippet),
      perspective: 'center',
      label: 'Center Source',
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
      console.warn(`[CENTER] Brave failed, trying Firecrawl fallback: ${braveError}`);
      source = 'firecrawl';
      try {
        articles = await searchFirecrawl(topic);
      } catch (firecrawlError) {
        console.error(`[CENTER] Firecrawl fallback also failed: ${firecrawlError}`);
      }
    }

    console.log(`[CENTER] Final result: ${articles.length} articles from ${source}`);

    return new Response(JSON.stringify({ success: true, articles, source }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CENTER] Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error), articles: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
