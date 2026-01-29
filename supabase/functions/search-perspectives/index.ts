import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NewsArticle {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  bias: 'left' | 'center' | 'right';
}

// Domain lists based on AllSides Media Bias Chart
const domainsByBias: Record<'left' | 'center' | 'right', string[]> = {
  left: [
    'nytimes.com', 'washingtonpost.com', 'cnn.com', 'nbcnews.com', 'npr.org',
    'abcnews.go.com', 'cbsnews.com', 'msnbc.com', 'theguardian.com', 'politico.com',
    'huffpost.com', 'vox.com', 'slate.com', 'theatlantic.com', 'thedailybeast.com',
  ],
  center: [
    'reuters.com', 'apnews.com', 'bbc.com', 'forbes.com', 'usatoday.com',
    'newsweek.com', 'thehill.com', 'axios.com', 'csmonitor.com', 'pbs.org',
  ],
  right: [
    'foxnews.com', 'nypost.com', 'wsj.com', 'washingtonexaminer.com', 'dailywire.com',
    'nationalreview.com', 'breitbart.com', 'newsmax.com', 'dailycaller.com', 'thefederalist.com',
    'washingtontimes.com', 'theblaze.com', 'foxbusiness.com', 'freebeacon.com', 'townhall.com',
  ],
};

// Build a hostname → bias lookup
const domainToBias: Record<string, 'left' | 'center' | 'right'> = {};
for (const bias of ['left', 'center', 'right'] as const) {
  for (const d of domainsByBias[bias]) {
    domainToBias[d.toLowerCase()] = bias;
  }
}

function detectOutletFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const nameMap: Record<string, string> = {
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
      'reuters.com': 'Reuters',
      'apnews.com': 'AP News',
      'bbc.com': 'BBC',
      'forbes.com': 'Forbes',
      'usatoday.com': 'USA Today',
      'newsweek.com': 'Newsweek',
      'thehill.com': 'The Hill',
      'axios.com': 'Axios',
      'csmonitor.com': 'Christian Science Monitor',
      'pbs.org': 'PBS',
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
    return nameMap[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
  } catch {
    return 'Unknown Source';
  }
}

function isArticlePath(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path === '/' || path === '') return false;
    if (path.startsWith('/people') || path.startsWith('/author') || path.startsWith('/writers')) return false;
    if (path.includes('/tag/') || path.includes('/tags/') || path.includes('/topic/') || path.includes('/topics/')) return false;
    if (path.includes('/category/') || path.includes('/categories/') || path.includes('/section/')) return false;
    return path.length > 10;
  } catch {
    return false;
  }
}

function getBiasForUrl(url: string): 'left' | 'center' | 'right' | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    if (domainToBias[hostname]) return domainToBias[hostname];
    for (const d of Object.keys(domainToBias)) {
      if (hostname.endsWith('.' + d)) return domainToBias[d];
    }
    return null;
  } catch {
    return null;
  }
}

// ============ VERTEX AI SEARCH (PRIMARY) ============

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

// Generate JWT for Google Cloud authentication
async function generateGoogleJWT(serviceAccountKey: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountKey.client_email,
    sub: serviceAccountKey.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key for signing
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = serviceAccountKey.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\n/g, '');
  
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
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${unsignedToken}.${signatureB64}`;
}

// Exchange JWT for access token
async function getGoogleAccessToken(serviceAccountKey: ServiceAccountKey): Promise<string> {
  const jwt = await generateGoogleJWT(serviceAccountKey);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to get Google access token:', error);
    throw new Error('Failed to authenticate with Google Cloud');
  }

  const data = await response.json();
  return data.access_token;
}

async function searchVertexAI(
  topic: string,
  bias: 'left' | 'center' | 'right',
  accessToken: string,
  projectId: string,
  engineId: string
): Promise<NewsArticle[]> {
  const domains = domainsByBias[bias];
  const topicClean = String(topic).replace(/["""]/g, '').trim();
  
  // Build filter for specific news domains
  const domainFilters = domains.slice(0, 10).map(d => `"${d}"`).join(', ');
  
  const endpoint = `https://discoveryengine.googleapis.com/v1/projects/${projectId}/locations/global/collections/default_collection/engines/${engineId}/servingConfigs/default_search:search`;

  console.log(`[${bias}] Vertex AI Search: ${topicClean.slice(0, 50)}...`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: topicClean,
        pageSize: 10,
        queryExpansionSpec: { condition: 'AUTO' },
        spellCorrectionSpec: { mode: 'AUTO' },
        contentSearchSpec: {
          snippetSpec: { returnSnippet: true },
          summarySpec: { summaryResultCount: 5 },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${bias}] Vertex AI Search error: ${response.status} - ${errorText.slice(0, 300)}`);
      return [];
    }

    const data = await response.json();
    const results = data.results || [];
    
    console.log(`[${bias}] Vertex AI returned ${results.length} results`);

    const articles: NewsArticle[] = [];
    for (const result of results) {
      const doc = result.document?.derivedStructData || result.document?.structData || {};
      const url = doc.link || doc.url || '';
      
      if (!url || !isArticlePath(url)) continue;
      
      const detectedBias = getBiasForUrl(url);
      if (detectedBias !== bias) continue;

      const outlet = detectOutletFromUrl(url);
      const title = doc.title || doc.htmlTitle || `Article from ${outlet}`;
      const snippet = doc.snippet || doc.htmlSnippet || doc.pagemap?.metatags?.[0]?.['og:description'] || title;

      articles.push({ url, title: cleanText(title), outlet, snippet: cleanText(snippet), bias });
    }

    return articles;
  } catch (error) {
    console.error(`[${bias}] Vertex AI Search fetch error:`, error);
    return [];
  }
}

function cleanText(text: string): string {
  return (text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Search all biases in parallel with Vertex AI Search
async function searchAllVertexAI(
  topic: string,
  accessToken: string,
  projectId: string,
  engineId: string
): Promise<NewsArticle[]> {
  console.log('Using Vertex AI Search (primary)');
  
  const [left, center, right] = await Promise.all([
    searchVertexAI(topic, 'left', accessToken, projectId, engineId),
    searchVertexAI(topic, 'center', accessToken, projectId, engineId),
    searchVertexAI(topic, 'right', accessToken, projectId, engineId),
  ]);

  const articles = [...left, ...center, ...right];
  
  console.log(`Vertex AI total: left=${left.length}, center=${center.length}, right=${right.length}`);
  
  return articles;
}

// ============ FIRECRAWL FALLBACK ============

async function searchFirecrawlForBias(
  topic: string,
  bias: 'left' | 'center' | 'right',
  firecrawlKey: string,
  tbs: 'qdr:w' | 'qdr:m'
): Promise<NewsArticle[]> {
  const topicClean = String(topic).replace(/["""]/g, '').trim();
  const domains = domainsByBias[bias];
  const siteFilters = domains.map(d => `site:${d}`).join(' OR ');
  const query = `${topicClean} (${siteFilters})`;

  console.log(`[${bias}] Firecrawl fallback search`);

  try {
    // Small retry loop to reduce transient network flakiness (e.g. ECONNREFUSED)
    const maxAttempts = 3;
    let lastErrorText = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            limit: 8,
            lang: 'en',
            tbs,
            scrapeOptions: { formats: ['markdown'] },
          }),
        });

        if (!response.ok) {
          lastErrorText = await response.text();
          console.error(`[${bias}] Firecrawl error (attempt ${attempt}/${maxAttempts}): ${lastErrorText.slice(0, 200)}`);
        } else {
          const data = await response.json();
          const results = data.data || [];
          
          const articles: NewsArticle[] = [];
          for (const result of results) {
            const url = result?.url;
            if (!url || !isArticlePath(url)) continue;
            if (getBiasForUrl(url) !== bias) continue;
 
            const outlet = detectOutletFromUrl(url);
            let title = result.title || `Article from ${outlet}`;
            title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*_`]/g, '').trim();
            
            let snippet = result.description || result.markdown?.slice(0, 300) || title;
            snippet = snippet.replace(/[#*_`]/g, '').trim();
 
            articles.push({ url, title, outlet, snippet, bias });
          }
 
          console.log(`[${bias}] Firecrawl found ${articles.length} articles`);
          return articles;
        }
      } catch (e) {
        lastErrorText = String(e);
        console.error(`[${bias}] Firecrawl fetch error (attempt ${attempt}/${maxAttempts}):`, e);
      }

      // basic backoff: 300ms, 600ms
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }

    return [];
  } catch (error) {
    console.error(`[${bias}] Firecrawl fetch error:`, error);
    return [];
  }
}

// ============ PERPLEXITY LAST RESORT ============

async function searchPerplexityForBias(
  topic: string,
  bias: 'left' | 'center' | 'right',
  perplexityKey: string,
  recency: 'week' | 'month'
): Promise<NewsArticle[]> {
  const topicClean = String(topic).replace(/["""]/g, '').trim();
  const domains = domainsByBias[bias];
  const siteFilters = domains.map(d => `site:${d}`).join(' OR ');
  const query = `${topicClean} (${siteFilters})`;

  console.log(`[${bias}] Perplexity last-resort search`);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: `Find recent news articles about: ${query}. Return article links only.`
          }
        ],
        search_recency_filter: recency,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[${bias}] Perplexity error: ${err.slice(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const citations = (data.citations || []) as string[];
    const content = data.choices?.[0]?.message?.content || '';

    const articles: NewsArticle[] = [];
    for (const url of citations) {
      if (!url || !url.startsWith('http')) continue;
      if (!isArticlePath(url)) continue;
      if (getBiasForUrl(url) !== bias) continue;
      
      const outlet = detectOutletFromUrl(url);
      articles.push({
        url,
        title: `Article from ${outlet}`,
        outlet,
        snippet: content.slice(0, 220) + '...',
        bias,
      });
    }

    console.log(`[${bias}] Perplexity found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error(`[${bias}] Perplexity fetch error:`, error);
    return [];
  }
}

// ============ MAIN SEARCH ORCHESTRATOR ============

async function searchNews(
  topic: string,
  vertexAccessToken: string | undefined,
  projectId: string | undefined,
  engineId: string | undefined,
  firecrawlKey: string | undefined,
  perplexityKey: string | undefined
): Promise<NewsArticle[]> {
  console.log(`Searching perspectives for: ${topic}`);

  let articles: NewsArticle[] = [];

  const addUnique = (incoming: NewsArticle[]) => {
    const seen = new Set(articles.map((a) => a.url));
    for (const a of incoming) {
      if (!a?.url) continue;
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      articles.push(a);
    }
  };

  const hasBias = (b: 'left' | 'center' | 'right') => articles.some(a => a.bias === b);
  const getMissingBiases = () => (['left', 'center', 'right'] as const).filter(b => !hasBias(b));

  // PRIMARY: Vertex AI Search
  if (vertexAccessToken && projectId && engineId) {
    console.log('Using Vertex AI Search as primary provider');
    const vertexResults = await searchAllVertexAI(topic, vertexAccessToken, projectId, engineId);
    addUnique(vertexResults);
  }

  const tryFillMissing = async (opts: { tbs: 'qdr:w' | 'qdr:m'; recency: 'week' | 'month' }) => {
    const missing = getMissingBiases();
    if (missing.length === 0) return;

    // Firecrawl for missing biases (FALLBACK 1)
    if (firecrawlKey) {
      console.log(`Filling biases with Firecrawl (${opts.tbs}): ${missing.join(', ')}`);
      const firecrawlResults = await Promise.all(
        missing.map(b => searchFirecrawlForBias(topic, b, firecrawlKey, opts.tbs))
      );
      addUnique(firecrawlResults.flat());
    }

    const stillMissing = getMissingBiases();
    if (stillMissing.length === 0) return;

    // Perplexity for still missing (FALLBACK 2)
    if (perplexityKey) {
      console.log(`Filling still-missing biases with Perplexity (${opts.recency}): ${stillMissing.join(', ')}`);
      const perplexityResults = await Promise.all(
        stillMissing.map(b => searchPerplexityForBias(topic, b, perplexityKey, opts.recency))
      );
      addUnique(perplexityResults.flat());
    }
  };

  // First pass (week) - fill missing biases
  await tryFillMissing({ tbs: 'qdr:w', recency: 'week' });

  // If we still can't populate all 3 perspectives, expand recency window (month)
  if (getMissingBiases().length > 0) {
    console.log('Expanding recency window to month as fallback.');
    await tryFillMissing({ tbs: 'qdr:m', recency: 'month' });
  }

  // Dedupe by URL
  const seen = new Set<string>();
  const deduped = articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  console.log(`Final: left=${deduped.filter(a => a.bias === 'left').length}, center=${deduped.filter(a => a.bias === 'center').length}, right=${deduped.filter(a => a.bias === 'right').length}`);
  return deduped;
}

function pickByBias(articles: NewsArticle[], bias: 'left' | 'center' | 'right'): NewsArticle | undefined {
  return articles.find(a => a.bias === bias);
}

function normalizeText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(text: string): string[] {
  const stop = new Set([
    'the','a','an','and','or','but','to','of','in','on','for','with','from','by','at','as','is','are','was','were','be','been',
    'this','that','these','those','it','its','their','they','them','he','she','his','her','you','your','we','our','us',
    'calls','call','says','said','tells','told','latest','breaking','report','reports','news','video','live','update',
  ]);
  const tokens = normalizeText(text).split(' ').filter(Boolean);
  const keywords = tokens
    .filter(t => t.length >= 4 && !stop.has(t))
    .slice(0, 20);
  return Array.from(new Set(keywords));
}

function isFactCheckRelevant(opts: {
  topic: string;
  headline: string;
  claimText: string;
  reviewTitle: string;
}): boolean {
  const topicKeys = extractKeywords(opts.topic);
  const headKeys = extractKeywords(opts.headline);
  const keys = Array.from(new Set([...topicKeys, ...headKeys])).slice(0, 25);

  const hay = normalizeText(`${opts.claimText} ${opts.reviewTitle}`);
  if (!hay) return false;

  const topicMatches = topicKeys.filter(k => hay.includes(k)).length;
  if (topicKeys.length > 0 && topicMatches === 0) return false;

  const totalMatches = keys.filter(k => hay.includes(k)).length;
  return totalMatches >= 2;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    // Vertex AI Search credentials
    const serviceAccountKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
    const engineId = Deno.env.get('VERTEX_SEARCH_ENGINE_ID');

    if (!aiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Vertex AI access token if credentials are available
    let vertexAccessToken: string | undefined;
    if (serviceAccountKeyJson && projectId && engineId) {
      try {
        const serviceAccountKey: ServiceAccountKey = JSON.parse(serviceAccountKeyJson);
        vertexAccessToken = await getGoogleAccessToken(serviceAccountKey);
        console.log('Vertex AI Search credentials configured');
      } catch (e) {
        console.error('Failed to parse service account key or get access token:', e);
      }
    }

    console.log('Searching perspectives for topic:', topic);
    console.log('Vertex AI Search available:', !!vertexAccessToken);
    console.log('Firecrawl available:', !!firecrawlKey);
    console.log('Perplexity available:', !!perplexityKey);

    const realArticles = await searchNews(topic, vertexAccessToken, projectId, engineId, firecrawlKey, perplexityKey);

    if (realArticles.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No verified articles found for this topic. Try a different search term.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const leftArticle = pickByBias(realArticles, 'left');
    const centerArticle = pickByBias(realArticles, 'center');
    const rightArticle = pickByBias(realArticles, 'right');

    const perspectives = [
      {
        perspective: 'left',
        label: 'Left-Leaning Source',
        outlet: leftArticle?.outlet || 'No left-leaning sources found',
        headline: leftArticle?.title || 'No article found',
        summary: leftArticle?.snippet || 'No summary available.',
        timeAgo: 'Recently',
        articleUrl: leftArticle?.url || '',
        factChecks: [],
      },
      {
        perspective: 'center',
        label: 'Center Source',
        outlet: centerArticle?.outlet || 'No center sources found',
        headline: centerArticle?.title || 'No article found',
        summary: centerArticle?.snippet || 'No summary available.',
        timeAgo: 'Recently',
        articleUrl: centerArticle?.url || '',
        factChecks: [],
      },
      {
        perspective: 'right',
        label: 'Right-Leaning Source',
        outlet: rightArticle?.outlet || 'No right-leaning sources found',
        headline: rightArticle?.title || 'No article found',
        summary: rightArticle?.snippet || 'No summary available.',
        timeAgo: 'Recently',
        articleUrl: rightArticle?.url || '',
        factChecks: [],
      },
    ];

    // Get topic metadata from AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Return ONLY valid JSON. Provide a short title, one-sentence description, and 3 tags. Example: {"title":"...","description":"...","tags":["...","...","..."]}'
          },
          { role: 'user', content: `Generate metadata for topic: "${topic}"` }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    let topicMetadata = {
      title: topic,
      description: `Coverage of ${topic}`,
      tags: ['News', 'Politics', 'Current Events']
    };

    if (response.ok) {
      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        try {
          topicMetadata = JSON.parse(content);
        } catch (e) {
          console.error('Failed to parse topic metadata:', e);
        }
      }
    }

    const parsedContent = {
      topic: { ...topicMetadata, date: currentDate },
      perspectives
    };

    // Search for fact-checks using Google Fact Check API
    const factCheckApiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');

    if (factCheckApiKey) {
      console.log('Searching fact-checks for each article...');

      await Promise.all(parsedContent.perspectives.map(async (perspective: any) => {
        perspective.factChecks = [];

        // Don't call Fact Check API when we don't actually have an article
        if (!perspective.articleUrl) return;
        if (!perspective.headline || perspective.headline === 'No article found') return;

        try {
          const query = `${topic} ${perspective.headline || ''}`.trim();
          const encodedQuery = encodeURIComponent(query.slice(0, 150));
          const fcResponse = await fetch(
            `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodedQuery}&key=${factCheckApiKey}&languageCode=en`,
            { method: 'GET' }
          );

          if (!fcResponse.ok) return;

          const fcData = await fcResponse.json();
          const claims = fcData.claims || [];

          for (const claim of claims.slice(0, 10)) {
            const review = claim.claimReview?.[0];
            if (!review || !review.url) continue;

            const claimText = claim.text || '';
            const reviewTitle = review.title || '';

            if (!isFactCheckRelevant({ topic, headline: perspective.headline || '', claimText, reviewTitle })) {
              continue;
            }

            const rating = (review.textualRating || '').toLowerCase();
            let status = 'disputed';
            if (rating.includes('true') || rating.includes('correct')) status = 'verified';
            else if (rating.includes('false') || rating.includes('wrong')) status = 'false';

            perspective.factChecks.push({
              claimText: claim.text || '',
              claimant: claim.claimant || 'Unknown',
              rating: review.textualRating || '',
              status,
              source: review.publisher?.name || 'Fact Checker',
              sourceUrl: review.url || '',
              title: review.title || '',
            });

            if (perspective.factChecks.length >= 3) break;
          }

          console.log(`${perspective.perspective}: ${perspective.factChecks.length} fact-checks`);
        } catch (fcError) {
          console.error(`Fact-check error for ${perspective.perspective}:`, fcError);
        }
      }));
    }

    console.log('Successfully analyzed topic with real articles');

    return new Response(
      JSON.stringify({ success: true, data: parsedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in search-perspectives:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
