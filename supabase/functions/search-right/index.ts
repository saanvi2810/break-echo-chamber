const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Brave Goggles ID for right-leaning sources
const GOGGLES_ID = 'https://raw.githubusercontent.com/saanvi2810/break-echo-chamber/main/public/goggles/right-sources.goggle';

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
  'ijr.com': 'IJR',
};

interface Article {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  perspective: 'left' | 'center' | 'right';
  label: string;
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

  console.log(`[RIGHT] Searching with Goggles: "${topicClean}"`);

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
    console.error(`[RIGHT] Brave Search error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Brave Search ${response.status}`);
  }

  const data = await response.json();
  const results = data.web?.results || [];
  console.log(`[RIGHT] Brave Goggles returned ${results.length} results`);

  const articles: Article[] = [];
  for (const result of results) {
    const url = result.url || '';
    if (!url || !isArticlePath(url)) continue;

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

  console.log(`[RIGHT] Found ${articles.length} articles`);
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

    console.log(`[RIGHT] Final result: ${articles.length} articles`);

    return new Response(JSON.stringify({ success: true, articles, source: 'brave-goggles' }), {
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
