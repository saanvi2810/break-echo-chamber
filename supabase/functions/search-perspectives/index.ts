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

// Domain lists based on AllSides Media Bias Chart (max 20 per Perplexity API limit)
// LEFT = Left + Lean Left sources
// CENTER = Center sources  
// RIGHT = Lean Right + Right sources
const domainsByBias: Record<'left' | 'center' | 'right', string[]> = {
  // Left + Lean Left (AllSides chart)
  left: [
    'alternet.org', 'apnews.com', 'theatlantic.com', 'thedailybeast.com', 'democracynow.org',
    'theguardian.com', 'huffpost.com', 'theintercept.com', 'jacobin.com', 'motherjones.com',
    'msnbc.com', 'thenation.com', 'newyorker.com', 'slate.com', 'vox.com',
    // Lean Left
    'abcnews.go.com', 'axios.com', 'bloomberg.com', 'cbsnews.com', 'cnbc.com',
    'cnn.com', 'insider.com', 'businessinsider.com', 'thehill.com', 'nbcnews.com',
    'nytimes.com', 'npr.org', 'politico.com', 'propublica.org', 'semafor.com',
    'time.com', 'usatoday.com', 'washingtonpost.com', 'news.yahoo.com'
  ],
  // Center (AllSides chart)
  center: [
    '1440.io', 'bbc.com', 'csmonitor.com', 'forbes.com', 'marketwatch.com',
    'morningbrew.com', 'newsnationnow.com', 'newsweek.com', 'reason.com',
    'reuters.com', 'tangle.media', 'wsj.com'
  ],
  // Lean Right + Right (AllSides chart)
  right: [
    // Lean Right
    'dailymail.co.uk', 'thedispatch.com', 'theepochtimes.com', 'foxbusiness.com',
    'thefp.com', 'justthenews.com', 'nationalreview.com', 'nypost.com',
    'realclearpolitics.com', 'upward.news', 'washingtonexaminer.com', 'washingtontimes.com', 'zerohedge.com',
    // Right
    'theamericanconservative.com', 'spectator.org', 'theblaze.com', 'breitbart.com',
    'cbn.com', 'dailycaller.com', 'dailywire.com', 'foxnews.com', 'thefederalist.com',
    'ijr.com', 'newsmax.com', 'oann.com', 'thepostmillennial.com', 'freebeacon.com'
  ],
};

async function searchNewsByBias(
  topic: string,
  perplexityKey: string,
  bias: 'left' | 'center' | 'right'
): Promise<NewsArticle[]> {
  const allDomains = domainsByBias[bias];
  // Use top 10 domains for explicit site: query (more reliable than search_domain_filter)
  const topDomains = allDomains.slice(0, 10);
  
  // Build explicit site filter query - this is more reliable than the API parameter
  const siteFilter = topDomains.map(d => `site:${d}`).join(' OR ');
  const searchQuery = `${topic} (${siteFilter})`;
  
  console.log(`Searching ${bias} sources for: ${topic}`);
  console.log(`Query: ${searchQuery.slice(0, 200)}...`);

  // Ask Perplexity to find and summarize actual articles
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
          content: `Find recent news articles about "${topic}" from these specific sources: ${topDomains.join(', ')}.

For each article found, provide:
1. The exact headline
2. The source/outlet name  
3. The article URL
4. A 2-3 sentence factual summary of what the article actually reports

Only include articles from the sources listed above. Focus on factual reporting, not interpretation.`
        }
      ],
      search_recency_filter: 'month', // Broader time range for better results
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Perplexity ${bias} search error:`, errorText);
    return [];
  }

  const data = await response.json();
  const citations: string[] = data.citations || [];
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log(`${bias} search found ${citations.length} citations`);
  console.log(`${bias} content preview:`, content.slice(0, 500));

  const articles: NewsArticle[] = [];

  // Strategy 1: Use citations if available
  if (citations.length > 0) {
    for (const url of citations) {
      if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
      
      try {
        const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
        // Check if URL is from our allowed domains
        const isValid = allDomains.some(d => hostname.includes(d.replace('www.', '')));
        if (!isValid) continue;
        
        const outlet = detectOutletFromUrl(url);
        const urlDomain = hostname.split('.')[0];
        
        // Try to extract info about this article from content
        let title = `Article from ${outlet}`;
        let snippet = '';
        
        // Look for headline patterns
        const headlinePatterns = [
          new RegExp(`\\*\\*(?:Headline:?)?\\s*\\*\\*\\s*([^\\n*]+)`, 'gim'),
          new RegExp(`(?:^|\\n)\\d+\\.\\s*\\*?\\*?(?:Headline:?)?\\s*\\*?\\*?\\s*([^\\n]+)`, 'gim'),
        ];
        
        for (const pattern of headlinePatterns) {
          const matches = [...content.matchAll(pattern)];
          for (const match of matches) {
            if (match[1] && match[1].length > 15 && match[1].length < 200) {
              title = match[1].replace(/\*+/g, '').trim();
              break;
            }
          }
        }
        
        // Look for summary patterns
        const summaryPatterns = [
          new RegExp(`\\*\\*Summary:?\\*\\*\\s*([^\\n]+(?:\\n[^\\n*]+)*)`, 'gim'),
          new RegExp(`(?:${urlDomain}|${outlet})[^.]*?[\\.:]\\s*([^\\n]{50,300})`, 'i'),
        ];
        
        for (const pattern of summaryPatterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            snippet = match[1].trim().slice(0, 400);
            break;
          }
        }
        
        articles.push({
          url,
          title,
          outlet,
          snippet: snippet || '',
          bias,
        });
      } catch {
        continue;
      }
    }
  }
  
  // Strategy 2: Parse articles directly from content if no valid citations
  if (articles.length === 0 && content.length > 100) {
    console.log(`${bias}: No citations, parsing content directly`);
    
    // Parse structured article blocks from the content
    const articleBlocks = content.split(/(?=\*\*\d+\.|(?:^|\n)\d+\.)/);
    
    for (const block of articleBlocks) {
      if (block.length < 50) continue;
      
      // Extract headline
      const headlineMatch = block.match(/\*\*(?:Headline:?\s*)?\*\*\s*([^\n*]+)/i) 
        || block.match(/\d+\.\s*\*?\*?(?:Headline:?\s*)?\*?\*?\s*([^\n]+)/i);
      
      // Extract source
      const sourceMatch = block.match(/\*\*Source:?\*\*\s*([^\n*]+)/i)
        || block.match(/Source:?\s*([A-Za-z][A-Za-z\s]+?)(?:\n|$)/i);
      
      // Extract URL
      const urlMatch = block.match(/\*\*(?:URL|Article URL|Link):?\*\*\s*(https?:\/\/[^\s\n]+)/i)
        || block.match(/(https?:\/\/[^\s\n\[\]]+)/);
      
      // Extract summary
      const summaryMatch = block.match(/\*\*Summary:?\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i)
        || block.match(/(?:Summary|reports?|says?)[:\s]+([^*\n]{50,400})/i);
      
      if (headlineMatch || sourceMatch) {
        const title = headlineMatch?.[1]?.replace(/\*+/g, '').trim() || 'Article';
        const outlet = sourceMatch?.[1]?.replace(/\*+/g, '').trim() || 'News Source';
        const url = urlMatch?.[1]?.trim() || '';
        const snippet = summaryMatch?.[1]?.replace(/\*+/g, '').trim() || '';
        
        // Only add if we have enough info
        if (title.length > 10 && (url || outlet !== 'News Source')) {
          articles.push({
            url: url || `#${bias}-${articles.length}`,
            title,
            outlet,
            snippet,
            bias,
          });
        }
      }
    }
  }

  console.log(`${bias} search: ${articles.length} articles extracted`);
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

    if (!topic) {
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

    console.log('Searching perspectives for topic:', topic);

    // Search for real news articles using Perplexity
    let realArticles: NewsArticle[] = [];
    if (perplexityKey) {
      try {
        realArticles = await searchNews(topic, perplexityKey);
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

    // Build detailed article context with actual content from Perplexity
    const articleContext = realArticles.length > 0
      ? `\n\nREAL ARTICLES WITH CONTENT (use these exact URLs and summaries):\n${realArticles
          .slice(0, 12)
          .map((a) => `- [${(a.bias || 'center').toUpperCase()}] ${a.outlet}
  Title: ${a.title}
  URL: ${a.url}
  Content: ${a.snippet || 'No summary available'}`)
          .join('\n\n')}`
      : '';

    const systemPrompt = `You are a news analyst that organizes real articles by political perspective.
Your job is to SELECT and PRESENT real articles - NOT to interpret, spin, or editorialize them.

TODAY'S DATE IS: ${currentDate}
${articleContext}

IMPORTANT RULES:
1. You must respond with valid JSON only. No markdown, no code blocks.
2. ONLY use URLs from the REAL ARTICLES list above.
3. The "summary" field must be a FACTUAL summary of what the article ACTUALLY SAYS based on the Content provided above.
4. DO NOT add political interpretation, framing, or spin to the summaries.
5. DO NOT speculate about what "progressives think" or "conservatives believe" - just report what the article says.
6. If the Content field says something specific, use that. Don't make up what the article might say.

The JSON must follow this exact structure:
{
  "topic": {
    "title": "Brief topic title",
    "description": "One sentence factual description",
    "date": "${currentDate}",
    "tags": ["Tag1", "Tag2", "Tag3"]
  },
  "perspectives": [
    {
      "perspective": "left",
      "label": "Left-Leaning Source",
      "outlet": "Exact outlet name from article",
      "headline": "Exact headline from article",
      "summary": "Factual 2-3 sentence summary of what this specific article reports",
      "timeAgo": "Recently",
      "articleUrl": "Exact URL from article"
    },
    {
      "perspective": "center",
      "label": "Center Source",
      "outlet": "Exact outlet name from article",
      "headline": "Exact headline from article",
      "summary": "Factual 2-3 sentence summary of what this specific article reports",
      "timeAgo": "Recently",
      "articleUrl": "Exact URL from article"
    },
    {
      "perspective": "right",
      "label": "Right-Leaning Source", 
      "outlet": "Exact outlet name from article",
      "headline": "Exact headline from article",
      "summary": "Factual 2-3 sentence summary of what this specific article reports",
      "timeAgo": "Recently",
      "articleUrl": "Exact URL from article"
    }
  ]
}`;

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
          { role: 'user', content: `Organize coverage of "${topic}" by selecting one article from each political lean (left, center, right) from the provided list. Use the actual content provided to write factual summaries - do not interpret or add spin.` }
        ],
        temperature: 0.3, // Lower temperature for more factual output
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

    // Enforce real URLs (prevents hallucinated/fake links)
    enforceRealArticleUrls(parsedContent, realArticles);

    // Search for fact-checks for EACH article's specific content
    // Uses Google Fact Check API to find real fact-checks from Snopes, PolitiFact, etc.
    const factCheckApiKey = Deno.env.get('GOOGLE_FACT_CHECK_API_KEY');
    
    if (factCheckApiKey && parsedContent?.perspectives?.length > 0) {
      console.log('Searching fact-checks for each article...');
      
      // Process each perspective in parallel
      await Promise.all(parsedContent.perspectives.map(async (perspective: any) => {
        perspective.factChecks = []; // Initialize empty array
        
        if (!perspective.headline && !perspective.summary) return;
        
        try {
          // Search using headline first
          const queries = [perspective.headline];
          
          // Add first sentence of summary as secondary query
          if (perspective.summary) {
            const firstSentence = perspective.summary.split(/[.!?]/)[0]?.trim();
            if (firstSentence && firstSentence.length > 20 && firstSentence !== perspective.headline) {
              queries.push(firstSentence);
            }
          }
          
          const seenUrls = new Set<string>();
          
          for (const query of queries) {
            const encodedQuery = encodeURIComponent(query.slice(0, 150));
            const fcResponse = await fetch(
              `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodedQuery}&key=${factCheckApiKey}&languageCode=en`,
              { method: 'GET' }
            );
            
            if (!fcResponse.ok) continue;
            
            const fcData = await fcResponse.json();
            const claims = fcData.claims || [];
            
            for (const claim of claims) {
              const review = claim.claimReview?.[0];
              if (!review || !review.url) continue;
              
              // Deduplicate by URL
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
              
              perspective.factChecks.push({
                claimText: claim.text || '',
                claimant: claim.claimant || 'Unknown',
                rating: review.textualRating || '',
                status,
                source: review.publisher?.name || 'Fact Checker',
                sourceUrl: review.url || '',
                title: review.title || '',
              });
            }
          }
          
          // Limit to 3 fact-checks per article
          perspective.factChecks = perspective.factChecks.slice(0, 3);
          console.log(`${perspective.perspective} article: ${perspective.factChecks.length} fact-checks found`);
          
        } catch (fcError) {
          console.error(`Fact-check error for ${perspective.perspective}:`, fcError);
        }
      }));
    } else if (!factCheckApiKey) {
      console.log('Google Fact Check API key not configured');
      // Initialize empty factChecks arrays
      parsedContent.perspectives?.forEach((p: any) => { p.factChecks = []; });
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
