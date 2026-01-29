import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
// Vertex AI helpers
// ─────────────────────────────────────────────────────────────

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

async function generateGoogleJWT(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: key.client_email,
    sub: key.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = key.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .trim();

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${unsignedToken}.${signatureB64}`;
}

async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const jwt = await generateGoogleJWT(key);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get access token');
  }
  const data = await response.json();
  return data.access_token;
}

async function searchVertexAI(topic: string): Promise<Article[]> {
  const serviceAccountKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
  const engineId = Deno.env.get('VERTEX_SEARCH_ENGINE_ID');

  if (!serviceAccountKeyJson || !projectId || !engineId) {
    throw new Error('Vertex AI not configured');
  }

  const serviceAccountKey: ServiceAccountKey = JSON.parse(serviceAccountKeyJson);
  const accessToken = await getAccessToken(serviceAccountKey);
  const topicClean = String(topic).replace(/["""]/g, '').trim();

  console.log(`[RIGHT] Searching Vertex AI for: ${topicClean.slice(0, 50)}...`);

  const endpoint = `https://discoveryengine.googleapis.com/v1/projects/${projectId}/locations/global/collections/default_collection/engines/${engineId}/servingConfigs/default_search:search`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: topicClean,
      pageSize: 30,
      queryExpansionSpec: { condition: 'AUTO' },
      spellCorrectionSpec: { mode: 'AUTO' },
      contentSearchSpec: {
        snippetSpec: { returnSnippet: true },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RIGHT] Vertex AI error: ${response.status} - ${errorText.slice(0, 300)}`);
    throw new Error(`Vertex AI ${response.status}`);
  }

  const data = await response.json();
  const results = data.results || [];
  console.log(`[RIGHT] Vertex AI returned ${results.length} results`);

  const articles: Article[] = [];
  for (const result of results) {
    const doc = result.document?.derivedStructData || result.document?.structData || {};
    const url = doc.link || doc.url || '';

    if (!url || !isAllowedDomain(url, RIGHT_DOMAINS) || !isArticlePath(url)) continue;

    const outlet = detectOutlet(url);
    const title = doc.title || doc.htmlTitle || `Article from ${outlet}`;
    const snippet = doc.snippet || doc.htmlSnippet || doc.pagemap?.metatags?.[0]?.['og:description'] || title;

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
    let source = 'vertex';

    try {
      articles = await searchVertexAI(topic);
    } catch (vertexError) {
      console.warn(`[RIGHT] Vertex failed, trying Firecrawl fallback: ${vertexError}`);
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
