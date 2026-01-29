const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LEFT_DOMAINS = [
  'nytimes.com', 'washingtonpost.com', 'cnn.com', 'nbcnews.com', 'npr.org',
  'abcnews.go.com', 'cbsnews.com', 'msnbc.com', 'theguardian.com', 'politico.com',
  'huffpost.com', 'vox.com', 'slate.com', 'theatlantic.com', 'thedailybeast.com',
];

const outletNames: Record<string, string> = {
  'nytimes.com': 'New York Times',
  'washingtonpost.com': 'Washington Post',
  'cnn.com': 'CNN',
  'nbcnews.com': 'NBC News',
  'npr.org': 'NPR',
  'abcnews.go.com': 'ABC News',
  'cbsnews.com': 'CBS News',
  'msnbc.com': 'MSNBC',
  'theguardian.com': 'The Guardian',
  'politico.com': 'Politico',
  'huffpost.com': 'HuffPost',
  'vox.com': 'Vox',
  'slate.com': 'Slate',
  'theatlantic.com': 'The Atlantic',
  'thedailybeast.com': 'The Daily Beast',
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
  
  // Build query with site: operators for left-leaning sources
  const siteOperators = LEFT_DOMAINS.slice(0, 5).map(d => `site:${d}`).join(' OR ');
  const fullQuery = `(${siteOperators}) ${topicClean}`;
  
  console.log(`[LEFT] Searching Brave: ${fullQuery.slice(0, 100)}...`);

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
    console.error(`[LEFT] Brave Search error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Brave Search ${response.status}`);
  }

  const data = await response.json();
  const results = data.web?.results || [];
  console.log(`[LEFT] Brave Search returned ${results.length} results`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';

    if (!url || !isAllowedDomain(url, LEFT_DOMAINS) || !isArticlePath(url)) continue;

    const outlet = detectOutlet(url);
    const title = result.title || `Article from ${outlet}`;
    const snippet = result.description || title;

    articles.push({
      url,
      title: cleanText(title),
      outlet,
      snippet: cleanText(snippet),
      perspective: 'left',
      label: 'Left-Leaning Source',
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

  // Build a query that targets left-leaning sources
  const siteQuery = LEFT_DOMAINS.slice(0, 5).map(d => `site:${d}`).join(' OR ');
  const query = `${topic} (${siteQuery})`;

  console.log(`[LEFT] Firecrawl fallback search: ${query.slice(0, 80)}...`);

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
    console.error(`[LEFT] Firecrawl error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Firecrawl ${response.status}`);
  }

  const data = await response.json();
  const results = data.data || [];
  console.log(`[LEFT] Firecrawl returned ${results.length} results`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';

    if (!url || !isAllowedDomain(url, LEFT_DOMAINS) || !isArticlePath(url)) continue;

    const outlet = detectOutlet(url);
    const title = result.title || `Article from ${outlet}`;
    const snippet = result.description || result.markdown?.slice(0, 200) || title;

    articles.push({
      url,
      title: cleanText(title),
      outlet,
      snippet: cleanText(snippet),
      perspective: 'left',
      label: 'Left-Leaning Source',
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
      console.warn(`[LEFT] Brave failed, trying Firecrawl fallback: ${braveError}`);
      source = 'firecrawl';
      try {
        articles = await searchFirecrawl(topic);
      } catch (firecrawlError) {
        console.error(`[LEFT] Firecrawl fallback also failed: ${firecrawlError}`);
      }
    }

    console.log(`[LEFT] Final result: ${articles.length} articles from ${source}`);

    return new Response(JSON.stringify({ success: true, articles, source }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[LEFT] Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error), articles: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
