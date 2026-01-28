import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PerplexityResult {
  url: string;
  title: string;
  snippet: string;
}

interface NewsArticle {
  url: string;
  title: string;
  outlet: string;
  snippet: string;
  bias?: 'left' | 'center' | 'right';
}

async function fetchArticleMetadata(url: string): Promise<{ title?: string; snippet?: string }> {
  // Best-effort HTML title/description extraction so we never show placeholder titles like
  // "Article from xyz" when the URL is real.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        // Many news sites block unknown agents; this still isn't perfect, but helps.
        'User-Agent': 'Mozilla/5.0 (compatible; LovableNewsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    let html = '';
    if (res.ok) {
      html = await res.text();
    } else {
      await res.arrayBuffer(); // consume
    }

    // Fallback: some publishers block bots. r.jina.ai provides a plain-text mirror.
    // We only use it to extract the title/description from the *same* real URL.
    if (!html) {
      try {
        const proxyRes = await fetch(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Accept': 'text/plain' },
        });
        if (proxyRes.ok) html = await proxyRes.text();
        else await proxyRes.arrayBuffer();
      } catch {
        // ignore
      }
    }

    if (!html) return {};
    // Basic extraction: og:title -> <title>
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1];
    const titleTag = html.match(/<title[^>]*>([^<]{3,200})<\/title>/i)?.[1];
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,400})["'][^>]*>/i)?.[1];
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,400})["'][^>]*>/i)?.[1];

    const clean = (s?: string) => (s ? s.replace(/\s+/g, ' ').trim() : undefined);
    return {
      title: clean(ogTitle) || clean(titleTag),
      snippet: clean(ogDesc) || clean(metaDesc),
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTopicInput(raw: unknown): string {
  const str = typeof raw === 'string' ? raw : '';
  return str
    .replace(/[#_]+/g, ' ')
    // Add spaces: "HHSHealthcare" -> "HHS Healthcare", "medicalTraining" -> "medical Training"
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

// Known outlet bias mapping
const outletBias: Record<string, 'left' | 'center' | 'right'> = {
  // Left-leaning
  'msnbc': 'left', 'huffpost': 'left', 'huffington post': 'left', 'the guardian': 'left',
  'vox': 'left', 'slate': 'left', 'daily beast': 'left', 'mother jones': 'left',
  'the atlantic': 'left', 'new york times': 'left', 'washington post': 'left',
  'cnn': 'left', 'nbc news': 'left', 'abc news': 'left', 'cbs news': 'left',
  'npr': 'left', 'politico': 'left', 'buzzfeed': 'left',
  // Center
  'reuters': 'center', 'ap news': 'center', 'associated press': 'center',
  'bbc': 'center', 'pbs': 'center', 'usa today': 'center', 'axios': 'center',
  'the hill': 'center', 'newsweek': 'center', 'time': 'center',
  // Right-leaning
  'fox news': 'right', 'wall street journal': 'right', 'wsj': 'right',
  'new york post': 'right', 'daily wire': 'right', 'breitbart': 'right',
  'the blaze': 'right', 'daily caller': 'right', 'washington examiner': 'right',
  'national review': 'right', 'the federalist': 'right', 'newsmax': 'right',
  'one america news': 'right', 'oan': 'right', 'epoch times': 'right',
};

function detectOutletFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const parts = hostname.split('.');
    return parts.slice(0, -1).join(' ').replace(/-/g, ' ');
  } catch {
    return 'Unknown Source';
  }
}

function titleFromUrlSlug(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const slug = decodeURIComponent(last)
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!slug || slug.length < 6) return '';
    // Title-case lightly (avoid shouting); keep acronyms as-is.
    return slug
      .split(' ')
      .map((w) => {
        if (w.toUpperCase() === w && w.length <= 5) return w; // likely acronym
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  } catch {
    return '';
  }
}

function detectBias(outlet: string, url: string): 'left' | 'center' | 'right' {
  const lowerOutlet = outlet.toLowerCase();
  const lowerUrl = url.toLowerCase();
  
  for (const [name, bias] of Object.entries(outletBias)) {
    if (lowerOutlet.includes(name) || lowerUrl.includes(name.replace(/\s+/g, ''))) {
      return bias;
    }
  }
  return 'center';
}

// Valid domains for each bias - based on AllSides Media Bias Chart v11
// LEFT = AllSides "Left" + "Lean Left" columns
// CENTER = AllSides "Center" column
// RIGHT = AllSides "Lean Right" + "Right" columns
const validDomains: Record<string, string[]> = {
  left: [
    // LEFT column
    'alternet.org', 'apnews.com', 'theatlantic.com', 'thedailybeast.com', 'democracynow.org',
    'theguardian.com', 'huffpost.com', 'theintercept.com', 'jacobin.com', 'motherjones.com',
    'msnbc.com', 'thenation.com', 'newyorker.com', 'slate.com', 'vox.com',
    // LEAN LEFT column
    'abcnews.go.com', 'axios.com', 'bloomberg.com', 'cbsnews.com', 'cnbc.com', 'cnn.com',
    'insider.com', 'businessinsider.com', 'thehill.com', 'nbcnews.com', 'nytimes.com', 'npr.org',
    'politico.com', 'propublica.org', 'semafor.com', 'time.com', 'usatoday.com',
    'washingtonpost.com', 'news.yahoo.com',
  ],
  center: [
    // CENTER column
    '1440.io', 'bbc.com', 'csmonitor.com', 'forbes.com', 'marketwatch.com', 'morningbrew.com',
    'newsnationnow.com', 'newsweek.com', 'reason.com', 'reuters.com', 'tangle.media',
    'wsj.com', // WSJ news section is center per chart
  ],
  right: [
    // LEAN RIGHT column
    'dailymail.co.uk', 'thedispatch.com', 'theepochtimes.com', 'foxbusiness.com', 'thefp.com',
    'justthenews.com', 'nationalreview.com', 'nypost.com', 'realclearpolitics.com',
    'upward.news', 'washingtonexaminer.com', 'washingtontimes.com', 'zerohedge.com',
    // RIGHT column
    'theamericanconservative.com', 'spectator.org', 'theblaze.com', 'breitbart.com', 'cbn.com',
    'dailycaller.com', 'dailywire.com', 'foxnews.com', 'thefederalist.com', 'ijr.com',
    'newsmax.com', 'oann.com', 'thepostmillennial.com', 'freebeacon.com',
  ],
};

function isValidSourceForBias(url: string, bias: 'left' | 'center' | 'right'): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    return validDomains[bias].some(domain => hostname.includes(domain) || hostname.endsWith(domain));
  } catch {
    return false;
  }
}

function normalizeCitationUrl(rawUrl: string): string {
  // Perplexity citations sometimes include redirect/tracking URLs (google.com/url?..., news.google.com/articles?...)
  // We try to extract the final publisher URL so domain validation works.
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace('www.', '');

    const candidates = ['url', 'u', 'q', 'target', 'redirect'];

    // Common redirectors: google.com/url, news.google.com, bing.com, etc.
    if (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'news.google.com' ||
      host === 'bing.com' ||
      host.endsWith('.bing.com') ||
      host === 'duckduckgo.com' ||
      host === 'perplexity.ai' ||
      host.endsWith('.perplexity.ai')
    ) {
      for (const key of candidates) {
        const v = u.searchParams.get(key);
        if (v && v.startsWith('http')) return v;
      }
    }

    // Some redirectors store the URL in the fragment
    if (u.hash) {
      const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
      try {
        const hp = new URLSearchParams(hash);
        for (const key of candidates) {
          const v = hp.get(key);
          if (v && v.startsWith('http')) return v;
        }
      } catch {
        // ignore
      }
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

async function searchNewsByBias(
  topic: string,
  perplexityKey: string,
  bias: 'left' | 'center' | 'right'
): Promise<NewsArticle[]> {
  // Two-pass strategy:
  // 1) Prefer strict domain-filtered search.
  // 2) If Perplexity returns 0 citations (common for niche/AI-generated topics), retry with a broader query,
  //    then apply our own allowlist filtering.

  // We'll constrain sources using chunked `site:` filters in the query text,
  // because `search_domain_filter` has proven unreliable (validation errors).
  const MAX_DOMAIN_FILTER = 15;
  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const domainChunks = chunk(validDomains[bias], MAX_DOMAIN_FILTER);
  const siteFilterFor = (domains: string[]) => domains.map((d) => `site:${d}`).join(' OR ');

  const desiredCount = 6;
  const minRequired = 1;
  const strictQuery = `Find up to ${desiredCount} recent news articles about "${topic}" from the allowed sources.
Return results with: (1) the exact on-page headline/title, (2) the publisher/outlet name, (3) the direct article URL.
Do NOT use placeholders like "Article from ...".`;
  const strictQuery2 = `Find up to ${desiredCount} additional recent news articles about "${topic}" from the allowed sources.
Return results with: exact on-page headline/title, outlet, and direct article URL.
Do NOT use placeholders like "Article from ...".`;
  // Note: fallback uses chunked site: filters to avoid excessively long prompts.
  const fallbackQueryFor = (domains: string[]) => `${topic} news (${siteFilterFor(domains)})`;

  console.log(`Searching ${bias} sources for:`, topic, 'domains:', validDomains[bias].join(', '));

  const runPerplexity = async (opts: { query: string; recency: 'day' | 'week' | 'month' | 'year' }) => {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a news research assistant. Return real news articles from the allowed publishers only. Do not include government websites, advocacy org sites, universities, Wikipedia, or press releases.`
          },
          { role: 'user', content: opts.query }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'news_results',
            schema: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      url: { type: 'string' },
                      title: { type: 'string' },
                      outlet: { type: 'string' },
                      snippet: { type: 'string' },
                    },
                    required: ['url', 'title'],
                  },
                },
              },
              required: ['results'],
            },
          },
        },
        search_recency_filter: opts.recency,
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });

    if (!r.ok) {
      const errorText = await r.text();
      console.error(`Perplexity ${bias} search error:`, errorText);
      return null;
    }

    return await r.json();
  };

  const extractStructuredResults = (data: any): PerplexityResult[] => {
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== 'string') return [];
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const arr = Array.isArray(parsed?.results) ? parsed.results : [];
      return arr
        .filter((r: any) => r && typeof r.url === 'string' && typeof r.title === 'string')
        .map((r: any) => ({
          url: r.url,
          title: r.title,
          snippet: typeof r.snippet === 'string' ? r.snippet : '',
        }));
    } catch {
      return [];
    }
  };

  const dedupeByUrl = (items: PerplexityResult[]) =>
    items.filter((it, idx, arr) => arr.findIndex((x) => x.url === it.url) === idx);

  let structured: PerplexityResult[] = [];

  const strictQueryFor = (domains: string[]) =>
    `Find up to ${desiredCount} recent news articles about "${topic}" from these sources only: (${siteFilterFor(domains)}).
Return results with: (1) the exact on-page headline/title, (2) the publisher/outlet name, (3) the direct article URL.
Do NOT use placeholders like "Article from ...".`;

  const strictQuery2For = (domains: string[]) =>
    `Find up to ${desiredCount} additional recent news articles about "${topic}" from these sources only: (${siteFilterFor(domains)}).
Return results with: exact on-page headline/title, outlet, and direct article URL.
Do NOT use placeholders like "Article from ...".`;

  // Pass 1: strict chunked searches (week).
  for (const domains of domainChunks.slice(0, 3)) {
    const data = await runPerplexity({ query: strictQueryFor(domains), recency: 'week' });
    structured = dedupeByUrl([...structured, ...extractStructuredResults(data)]);
    if (structured.length >= desiredCount) break;
  }

  // Pass 1b: if too few results, run a second strict query variant.
  if (structured.length > 0 && structured.length < desiredCount) {
    for (const domains of domainChunks.slice(0, 3)) {
      const data2 = await runPerplexity({ query: strictQuery2For(domains), recency: 'week' });
      structured = dedupeByUrl([...structured, ...extractStructuredResults(data2)]);
      if (structured.length >= desiredCount) break;
    }
  }

  // Pass 1c: broaden recency while still using domain_filter (month).
  if (structured.length < minRequired) {
    for (const domains of domainChunks.slice(0, 3)) {
      const dataMonth = await runPerplexity({ query: strictQueryFor(domains), recency: 'month' });
      structured = dedupeByUrl([...structured, ...extractStructuredResults(dataMonth)]);
      if (structured.length >= minRequired) break;
    }
  }

  // Pass 2: fallback (month) with explicit site filters in query, then we apply allowlist ourselves.
  if (structured.length < minRequired) {
    console.log(`${bias} strict (domain-filtered) returned <${minRequired}; retrying with fallback query`);
    for (const domains of domainChunks.slice(0, 3)) {
      const dataFallback = await runPerplexity({ query: fallbackQueryFor(domains), recency: 'month' });
      structured = dedupeByUrl([...structured, ...extractStructuredResults(dataFallback)]);
      if (structured.length >= minRequired) break;
    }
  }

  // Pass 3: broaden further (year) with site filters.
  if (structured.length < minRequired) {
    console.log(`${bias} still <${minRequired}; broadening to year recency`);
    for (const domains of domainChunks.slice(0, 3)) {
      const dataYear = await runPerplexity({ query: `${topic} (${siteFilterFor(domains)})`, recency: 'year' });
      structured = dedupeByUrl([...structured, ...extractStructuredResults(dataYear)]);
      if (structured.length >= minRequired) break;
    }
  }

  // Pass 4: fully unconstrained query (year), then we filter by our allowlist.
  if (structured.length < minRequired) {
    const openQuery = `${topic} news article`;
    console.log(`${bias} still <${minRequired}; running unconstrained search then filtering to allowlist`);
    const dataOpen = await runPerplexity({ query: openQuery, recency: 'year' });
    structured = dedupeByUrl([...structured, ...extractStructuredResults(dataOpen)]);
  }

  console.log(`${bias} search produced ${structured.length} structured results (before filtering)`);

  // Normalize/dedupe URLs then filter to valid sources
  const normalized = structured
    .filter((r) => r.url && typeof r.url === 'string' && r.url.startsWith('http'))
    .map((r) => ({ ...r, url: normalizeCitationUrl(r.url) }))
    .filter((r, idx, arr) => arr.findIndex((x) => x.url === r.url) === idx);

  if (normalized.length > 0) {
    console.log(`${bias} result hostnames (sample):`, normalized.slice(0, 5).map((u) => {
      try {
        return new URL(u.url).hostname;
      } catch {
        return 'invalid-url';
      }
    }));
  }

  const filtered = normalized
    .filter((r) => isValidSourceForBias(r.url, bias))
    .slice(0, desiredCount);

  // If we still have nothing after broadening, return empty (never invent articles).
  if (filtered.length < minRequired) {
    console.log(`${bias} search: 0 valid articles after broadening; returning empty`);
    return [];
  }

  // As a last resort (when provider returns a blank title), try to fetch metadata.
  const maybeFetch = await Promise.all(
    filtered.map(async (r) => {
      const t = (r.title || '').trim();
      if (t && t.length >= 4 && !/^article\s+from\s+/i.test(t)) return { title: t, snippet: r.snippet || '' };
      const meta = await fetchArticleMetadata(r.url);
      return { title: meta.title || t, snippet: meta.snippet || r.snippet || '' };
    })
  );

  const articles: NewsArticle[] = filtered.map((r, idx) => {
    const outlet = detectOutletFromUrl(r.url);
    const meta = maybeFetch[idx] || {};
    const finalTitle = (meta.title || r.title || '').trim();
    const slugTitle = titleFromUrlSlug(r.url);
    return {
      url: r.url,
      title: slugTitle || (finalTitle && finalTitle.length >= 4 && !/^article\s+from\s+/i.test(finalTitle) ? finalTitle : '' ) || `Article from ${outlet}`,
      outlet,
      snippet: meta.snippet || '',
      bias,
    };
  });

  console.log(`${bias} search: ${articles.length} valid articles after filtering`);
  return articles;
}

async function searchNews(topic: string, perplexityKey: string): Promise<NewsArticle[]> {
  console.log('Searching news with Perplexity for diverse sources:', topic);

  // Search each bias category in parallel to ensure diverse sources
  const [leftArticles, centerArticles, rightArticles] = await Promise.all([
    searchNewsByBias(topic, perplexityKey, 'left'),
    searchNewsByBias(topic, perplexityKey, 'center'),
    searchNewsByBias(topic, perplexityKey, 'right'),
  ]);

  const allArticles = [...leftArticles, ...centerArticles, ...rightArticles];
  console.log(`Total articles found: ${allArticles.length} (left: ${leftArticles.length}, center: ${centerArticles.length}, right: ${rightArticles.length})`);
  
  return allArticles;
}

function pickByBias(articles: NewsArticle[], bias: 'left' | 'center' | 'right'): NewsArticle | undefined {
  const candidates = articles.filter((a) => a.bias === bias);
  return candidates[0] || articles[0];
}

// Known fact-checking domains - URLs from these should be preserved
const factCheckDomains = [
  'snopes.com', 'politifact.com', 'factcheck.org', 'fullfact.org',
  'checkyourfact.com', 'leadstories.com', 'reuters.com/fact-check',
  'apnews.com/hub/ap-fact-check', 'washingtonpost.com/news/fact-checker',
  'bbc.com/news/reality_check', 'usatoday.com/news/factcheck',
];

function isFactCheckUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lowerUrl = url.toLowerCase();
  return factCheckDomains.some(domain => lowerUrl.includes(domain));
}

function enforceRealArticleUrls(parsedContent: any, realArticles: NewsArticle[]) {
  // Only enforce article URLs - DO NOT touch claim sourceUrls (those come from Google Fact Check API)
  if (!parsedContent?.perspectives || !Array.isArray(parsedContent.perspectives) || realArticles.length === 0) return;

  const allowedUrls = new Set(realArticles.map((a) => a.url));
  const left = pickByBias(realArticles, 'left');
  const center = pickByBias(realArticles, 'center');
  const right = pickByBias(realArticles, 'right');

  const fallbackFor = (p: any): NewsArticle | undefined => {
    if (p?.perspective === 'left') return left;
    if (p?.perspective === 'center') return center;
    if (p?.perspective === 'right') return right;
    return realArticles[0];
  };

  parsedContent.perspectives.forEach((p: any) => {
    const chosen = fallbackFor(p);
    if (!chosen) return;

    // Enforce articleUrl only
    if (!p.articleUrl || typeof p.articleUrl !== 'string' || !allowedUrls.has(p.articleUrl)) {
      p.articleUrl = chosen.url;
    }

    // Enforce outlet/headline when missing (or clearly placeholder)
    if (!p.outlet || typeof p.outlet !== 'string' || p.outlet.toLowerCase().includes('example')) {
      p.outlet = chosen.outlet;
    }
    if (!p.headline || typeof p.headline !== 'string' || p.headline.toLowerCase().includes('realistic headline')) {
      p.headline = chosen.title;
    }
    
    // DO NOT modify claim sourceUrls here - let fact-check API populate them
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();
    const normalizedTopic = normalizeTopicInput(topic);

    if (!normalizedTopic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching perspectives for topic:', normalizedTopic);

    // Search for real news articles using Perplexity
    let realArticles: NewsArticle[] = [];
    if (perplexityKey) {
      try {
         realArticles = await searchNews(normalizedTopic, perplexityKey);
        console.log(`Found ${realArticles.length} real articles`);
      } catch (e) {
        console.error('Perplexity search failed:', e);
      }
    } else {
      console.log('Perplexity API key not configured, skipping real article search');
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Group articles by bias
    const leftArticles = realArticles.filter(a => a.bias === 'left');
    const centerArticles = realArticles.filter(a => a.bias === 'center');
    const rightArticles = realArticles.filter(a => a.bias === 'right');

    // Build article lists for AI context - include full details
    const formatArticleList = (articles: NewsArticle[], label: string) => 
      articles.length > 0 
        ? `\n${label} ARTICLES:\n${articles.map((a, i) => `${i + 1}. Outlet: "${a.outlet}" | Title: "${a.title}" | URL: ${a.url}`).join('\n')}`
        : `\n${label} ARTICLES: None found`;

    const articleContext = 
      formatArticleList(leftArticles, 'LEFT-LEANING') + 
      formatArticleList(centerArticles, 'CENTER') + 
      formatArticleList(rightArticles, 'RIGHT-LEANING');

     const systemPrompt = `You are a news formatter. Your job is to organize the provided articles into a structured JSON format.

TODAY'S DATE IS: ${currentDate}
${articleContext}

CRITICAL RULES:
1. ONLY include articles that are explicitly listed above - DO NOT invent or add any articles
2. Each article MUST stay in its original category (left articles in left, center in center, right in right)
3. For each article, set "headline" to the EXACT "Title" provided above (no placeholders like "Article from ...")
4. Write a neutral, factual 1-2 sentence summary for each article based on its headline - DO NOT add political spin or framing
5. Use the EXACT outlet name and URL from the list above
5. If a category has no articles, return an empty articles array for that perspective

Respond with valid JSON only. No markdown, no code blocks.

{
  "topic": {
    "title": "Brief topic title based on the search",
    "description": "Neutral one sentence description",
    "date": "${currentDate}",
    "tags": ["Tag1", "Tag2", "Tag3"]
  },
  "perspectives": [
    {
      "perspective": "left",
      "label": "Left-Leaning Sources",
      "articles": [/* ONLY articles from LEFT-LEANING list above */]
    },
    {
      "perspective": "center", 
      "label": "Center Sources",
      "articles": [/* ONLY articles from CENTER list above */]
    },
    {
      "perspective": "right",
      "label": "Right-Leaning Sources", 
      "articles": [/* ONLY articles from RIGHT-LEANING list above */]
    }
  ]
}

Each article object: {"outlet": "...", "headline": "...", "summary": "...", "timeAgo": "Recently", "articleUrl": "..."}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
           { role: 'system', content: systemPrompt },
           { role: 'user', content: `Analyze the following topic from multiple perspectives: "${normalizedTopic}". ${realArticles.length > 0 ? 'Use the real articles provided to create accurate summaries with working URLs.' : 'Provide realistic news coverage as it would appear today.'}` }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze topic' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response
    let parsedContent;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        parsedContent = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce real URLs on articles within each perspective.
    // IMPORTANT: Do NOT filter articles out (that can wipe entire perspectives when the model slightly
    // rewrites/normalizes URLs). Instead, normalize and repair URLs by matching to our real citations.
    if (parsedContent?.perspectives && realArticles.length > 0) {
      const articlesByBias: Record<'left' | 'center' | 'right', NewsArticle[]> = {
        left: realArticles.filter((a) => a.bias === 'left'),
        center: realArticles.filter((a) => a.bias === 'center'),
        right: realArticles.filter((a) => a.bias === 'right'),
      };

      const normalizeForCompare = (raw: string) => {
        const normalized = normalizeCitationUrl(raw);
        try {
          const u = new URL(normalized);
          // strip tracking params so comparisons are more forgiving
          u.search = '';
          u.hash = '';
          return u.toString();
        } catch {
          return normalized;
        }
      };

      const hostnameOf = (raw: string) => {
        try {
          return new URL(normalizeCitationUrl(raw)).hostname.toLowerCase().replace(/^www\./, '');
        } catch {
          return '';
        }
      };

      parsedContent.perspectives.forEach((p: any) => {
        const bias = p?.perspective as 'left' | 'center' | 'right';
        const pool = articlesByBias[bias] || [];
        if (!p?.articles || !Array.isArray(p.articles) || pool.length === 0) return;

        const poolByNormalizedUrl = new Map<string, NewsArticle>();
        for (const a of pool) {
          poolByNormalizedUrl.set(normalizeForCompare(a.url), a);
        }

        p.articles = p.articles.map((article: any) => {
          const currentUrl = typeof article?.articleUrl === 'string' ? article.articleUrl : '';
          const normalizedCurrent = currentUrl ? normalizeForCompare(currentUrl) : '';
          const currentHost = currentUrl ? hostnameOf(currentUrl) : '';

          // 1) Exact-ish match after normalization
          let match = normalizedCurrent ? poolByNormalizedUrl.get(normalizedCurrent) : undefined;

          // 2) Match by hostname
          if (!match && currentHost) {
            match = pool.find((a) => hostnameOf(a.url) === currentHost);
          }

          // 3) Match by outlet label
          if (!match && typeof article?.outlet === 'string') {
            const outletLower = article.outlet.toLowerCase();
            match = pool.find((a) => a.outlet.toLowerCase() === outletLower);
          }

          // 4) Fallback: assign first available real article for that bias
          if (!match) match = pool[0];

          return {
            ...article,
            // Always enforce outlet/headline/url from the real-article pool.
            // This prevents placeholder headlines like "Article from ..." from leaking into the UI.
            outlet: match.outlet,
            headline: match.title,
            articleUrl: match.url,
          };
        });
      });
    }

    // Search for fact-checks for EACH article's specific content
    // Uses Google Fact Check API to find real fact-checks from Snopes, PolitiFact, etc.
    const factCheckApiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');
    
    if (factCheckApiKey && parsedContent?.perspectives?.length > 0) {
      console.log('Searching fact-checks for each article...');
      
      // Process each perspective and its articles
      for (const perspective of parsedContent.perspectives) {
        if (!perspective.articles || !Array.isArray(perspective.articles)) continue;
        
        // Process articles in parallel within each perspective
        await Promise.all(perspective.articles.map(async (article: any) => {
          article.factChecks = [];
          
          if (!article.headline) return;
          
          try {
            const encodedQuery = encodeURIComponent(article.headline.slice(0, 150));
            const fcResponse = await fetch(
              `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodedQuery}&key=${factCheckApiKey}&languageCode=en`,
              { method: 'GET' }
            );
            
            if (!fcResponse.ok) return;
            
            const fcData = await fcResponse.json();
            const claims = fcData.claims || [];
            
            const seenUrls = new Set<string>();
            
            for (const claim of claims.slice(0, 2)) {
              const review = claim.claimReview?.[0];
              if (!review || !review.url) continue;
              
              if (seenUrls.has(review.url)) continue;
              seenUrls.add(review.url);
              
              const rating = (review.textualRating || '').toLowerCase();
              let status = 'disputed';
              if (rating.includes('true') || rating.includes('correct') || rating.includes('accurate')) {
                status = 'verified';
              } else if (rating.includes('false') || rating.includes('wrong') || rating.includes('pants on fire')) {
                status = 'false';
              } else if (rating.includes('mixed') || rating.includes('partly') || rating.includes('misleading')) {
                status = 'disputed';
              }
              
              article.factChecks.push({
                claimText: claim.text || '',
                claimant: claim.claimant || 'Unknown',
                rating: review.textualRating || '',
                status,
                source: review.publisher?.name || 'Fact Checker',
                sourceUrl: review.url || '',
                title: review.title || '',
              });
            }
          } catch (fcError) {
            console.error(`Fact-check error for article:`, fcError);
          }
        }));
      }
      
      const totalArticles = parsedContent.perspectives.reduce((sum: number, p: any) => sum + (p.articles?.length || 0), 0);
      console.log(`Processed fact-checks for ${totalArticles} articles`);
    } else if (!factCheckApiKey) {
      console.log('Google Fact Check API key not configured');
      // Initialize empty factChecks arrays for all articles
      parsedContent.perspectives?.forEach((p: any) => {
        p.articles?.forEach((a: any) => { a.factChecks = []; });
      });
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
