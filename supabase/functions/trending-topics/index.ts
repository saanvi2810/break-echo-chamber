const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    console.log('Fetching trending topics from Perplexity...');

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
            content: `What are the 5 most talked about news topics TODAY? Return ONLY a JSON array of 5 short topic names (2-4 words each), no explanation. Example: ["Topic One", "Topic Two", "Topic Three", "Topic Four", "Topic Five"]`
          }
        ],
        temperature: 0.3,
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
    
    // Parse the JSON array from the response
    let topics: string[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse topics:', content);
    }

    // Ensure we have valid topics
    if (!Array.isArray(topics) || topics.length === 0) {
      topics = ["Breaking News", "Politics", "Technology", "Economy", "Climate"];
    }

    // Clean up and limit to 5 topics
    topics = topics
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .slice(0, 5)
      .map(t => t.trim());

    console.log('Trending topics:', topics);

    return new Response(
      JSON.stringify({ success: true, topics }),
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
