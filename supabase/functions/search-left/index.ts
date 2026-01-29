const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// AllSides-aligned Left & Lean Left sources
const LEFT_DOMAINS = [
  'msnbc.com', 'cnn.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com',
  'huffpost.com', 'vox.com', 'slate.com', 'theatlantic.com', 'thedailybeast.com',
  'motherjones.com', 'thenation.com', 'jacobin.com', 'currentaffairs.org', 'democracynow.org',
  'npr.org', 'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'politico.com',
  'newyorker.com', 'time.com', 'buzzfeednews.com', 'theintercept.com', 'propublica.org',
  'salon.com', 'vanityfair.com', 'rollingstone.com', 'esquire.com', 'gq.com',
  'bloomberg.com', 'businessinsider.com', 'vice.com', 'wired.com', 'arstechnica.com',
];

const outletNames: Record<string, string> = {
  'msnbc.com': 'MSNBC',
  'cnn.com': 'CNN',
  'nytimes.com': 'New York Times',
  'washingtonpost.com': 'Washington Post',
  'theguardian.com': 'The Guardian',
  'huffpost.com': 'HuffPost',
  'vox.com': 'Vox',
  'slate.com': 'Slate',
  'theatlantic.com': 'The Atlantic',
  'thedailybeast.com': 'The Daily Beast',
  'motherjones.com': 'Mother Jones',
  'thenation.com': 'The Nation',
  'jacobin.com': 'Jacobin',
  'currentaffairs.org': 'Current Affairs',
  'democracynow.org': 'Democracy Now',
  'npr.org': 'NPR',
  'nbcnews.com': 'NBC News',
  'abcnews.go.com': 'ABC News',
  'cbsnews.com': 'CBS News',
  'politico.com': 'Politico',
  'newyorker.com': 'The New Yorker',
  'time.com': 'TIME',
  'buzzfeednews.com': 'BuzzFeed News',
  'theintercept.com': 'The Intercept',
  'propublica.org': 'ProPublica',
  'salon.com': 'Salon',
  'vanityfair.com': 'Vanity Fair',
  'rollingstone.com': 'Rolling Stone',
  'esquire.com': 'Esquire',
  'gq.com': 'GQ',
  'bloomberg.com': 'Bloomberg',
  'businessinsider.com': 'Business Insider',
  'vice.com': 'Vice',
  'wired.com': 'Wired',
  'arstechnica.com': 'Ars Technica',
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
// Brave Search API - search broadly, filter to left sources
// ─────────────────────────────────────────────────────────────

async function searchBrave(topic: string): Promise<Article[]> {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
  if (!apiKey) {
    throw new Error('Brave Search API key not configured');
  }

  const topicClean = String(topic).replace(/["""]/g, '').trim();
  
  // Search broadly for news, then filter results to left-leaning sources
  const fullQuery = `${topicClean} news`;
  
  console.log(`[LEFT] Searching Brave broadly: "${fullQuery}"`);

  const params = new URLSearchParams({
    q: fullQuery,
    count: '50', // Request more results since we'll filter
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
    console.error(`[LEFT] Brave Search error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Brave Search ${response.status}`);
  }

  const data = await response.json();
  const results = data.web?.results || [];
  console.log(`[LEFT] Brave returned ${results.length} total results, filtering to left sources...`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';

    // Filter to only left-leaning domains
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

  console.log(`[LEFT] Found ${articles.length} articles from left-leaning sources`);
  return articles;
}

// ─────────────────────────────────────────────────────────────
// Firecrawl fallback - also search broadly
// ─────────────────────────────────────────────────────────────

async function searchFirecrawl(topic: string): Promise<Article[]> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    throw new Error('Firecrawl API key not configured');
  }

  const query = `${topic} news`;

  console.log(`[LEFT] Firecrawl fallback: "${query}"`);

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
    console.error(`[LEFT] Firecrawl error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Firecrawl ${response.status}`);
  }

  const data = await response.json();
  const results = data.data || [];
  console.log(`[LEFT] Firecrawl returned ${results.length} results, filtering to left sources...`);

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
