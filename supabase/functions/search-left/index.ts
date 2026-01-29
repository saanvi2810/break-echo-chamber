const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Brave Goggles ID for left-leaning sources
const GOGGLES_ID = 'https://raw.githubusercontent.com/saanvi2810/break-echo-chamber/main/public/goggles/left-sources.goggle';

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
  'theintercept.com': 'The Intercept',
  'propublica.org': 'ProPublica',
  'salon.com': 'Salon',
  'latimes.com': 'LA Times',
  'bostonglobe.com': 'Boston Globe',
  'vice.com': 'Vice',
  'vanityfair.com': 'Vanity Fair',
  'newrepublic.com': 'The New Republic',
  'prospect.org': 'The American Prospect',
  'rawstory.com': 'Raw Story',
  'alternet.org': 'AlterNet',
  'commondreams.org': 'Common Dreams',
  'truthout.org': 'Truthout',
  'mediamatters.org': 'Media Matters',
};

// Allowed domains for left-leaning sources (strict filtering)
const allowedDomains = new Set(Object.keys(outletNames));


interface Article {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  perspective: 'left' | 'center' | 'right';
  label: string;
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function isAllowedDomain(url: string): boolean {
  const hostname = getHostname(url);
  return hostname !== null && allowedDomains.has(hostname);
}

function detectOutlet(url: string): string {
  const hostname = getHostname(url);
  if (!hostname) return 'Unknown';
  return outletNames[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
}

function cleanText(text: string): string {
  return (text || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
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

// ─────────────────────────────────────────────────────────────
// Brave Search API with Goggles
// ─────────────────────────────────────────────────────────────

async function searchBrave(topic: string): Promise<Article[]> {
  const apiKey = Deno.env.get('BRAVE_SEARCH_API_KEY');
  if (!apiKey) {
    throw new Error('Brave Search API key not configured');
  }

  const topicClean = String(topic).replace(/["""]/g, '').trim();

  console.log(`[LEFT] Searching with Goggles: "${topicClean}"`);

  const params = new URLSearchParams({
    q: topicClean,
    count: '10',
    freshness: 'pw',
    text_decorations: 'false',
    goggles_id: GOGGLES_ID,
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
  console.log(`[LEFT] Brave Goggles returned ${results.length} results`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';
    if (!url || !isArticlePath(url) || !isAllowedDomain(url)) continue;

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

  console.log(`[LEFT] Found ${articles.length} articles`);
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

    const articles = await searchBrave(topic);

    console.log(`[LEFT] Final result: ${articles.length} articles`);

    return new Response(JSON.stringify({ success: true, articles, source: 'brave-goggles' }), {
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
