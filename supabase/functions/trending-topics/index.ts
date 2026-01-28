const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!perplexityKey) {
      // Return fallback topics if no API key
      return new Response(
        JSON.stringify({ 
          success: true, 
          topics: ["Breaking News", "Politics", "Technology", "Economy", "Climate"] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching trending topics from Perplexity (grounded w/ citations)...');

    // IMPORTANT: We require a sourceUrl per topic, and we only accept topics with real URLs.
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
            role: 'system',
            content: 'Return strictly valid JSON. Do not invent sources. Each topic must include a real, working news URL.',
          },
          {
            role: 'user',
            content:
              'Find 5 politically divisive or controversial news stories being debated today. For each, return a short topic (3–8 words) and one real source URL from a reputable news outlet. Return only JSON like: {"topics":[{"topic":"...","sourceUrl":"https://..."}]}',
          },
        ],
        temperature: 0.2,
        search_recency_filter: 'day',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'trending_topics',
            schema: {
              type: 'object',
              properties: {
                topics: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 5,
                  items: {
                    type: 'object',
                    properties: {
                      topic: { type: 'string' },
                      sourceUrl: { type: 'string' },
                    },
                    required: ['topic', 'sourceUrl'],
                  },
                },
              },
              required: ['topics'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', await response.text());
      return new Response(
        JSON.stringify({ 
          success: true, 
          topics: ["Breaking News", "Politics", "Technology", "Economy", "Climate"] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    type TopicItem = { topic: string; sourceUrl: string };
    let items: TopicItem[] = [];
    try {
      items = JSON.parse(content)?.topics ?? [];
    } catch (parseError) {
      console.error('Failed to parse topics JSON:', content);
    }

    // Validate URLs & topics; only accept items with real URLs.
    const topics = (Array.isArray(items) ? items : [])
      .filter((it): it is TopicItem => !!it && typeof it.topic === 'string' && typeof it.sourceUrl === 'string')
      .map((it) => ({ topic: it.topic.trim(), sourceUrl: it.sourceUrl.trim() }))
      .filter((it) => it.topic.length > 0)
      .filter((it) => {
        try {
          const u = new URL(it.sourceUrl);
          return u.protocol === 'https:' || u.protocol === 'http:';
        } catch {
          return false;
        }
      })
      .slice(0, 5);

    const topicNames = topics.map((t) => t.topic);

    const finalTopics = topicNames.length > 0
      ? topicNames
      : ["Breaking News", "Politics", "Technology", "Economy", "Climate"];

    console.log('Trending topics (validated):', finalTopics);
    if (topics.length > 0) {
      console.log('Trending topic sources:', topics.map((t) => t.sourceUrl));
    }

    return new Response(
      JSON.stringify({ success: true, topics: finalTopics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching trending topics:', error);
    return new Response(
      JSON.stringify({ 
        success: true, 
        topics: ["Breaking News", "Politics", "Technology", "Economy", "Climate"] 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
