import { useState, useEffect } from "react";
import { Search, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface TopicSearchProps {
  onSearch: (topic: string) => void;
  isLoading: boolean;
  retryAttempt?: number;
  error?: string;
  isNetworkError?: boolean;
  onRetry?: () => void;
}

const TopicSearch = ({ 
  onSearch, 
  isLoading, 
  retryAttempt = 0, 
  error,
  isNetworkError,
  onRetry 
}: TopicSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  useEffect(() => {
    const fetchTrendingTopics = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('trending-topics');
        if (error) throw error;
        if (data?.topics && Array.isArray(data.topics)) {
          setTrendingTopics(data.topics);
        }
      } catch (err) {
        console.error('Failed to fetch trending topics:', err);
        // Fallback topics
        setTrendingTopics(["Breaking News", "Politics", "Technology", "Economy", "Climate"]);
      } finally {
        setLoadingTopics(false);
      }
    };

    fetchTrendingTopics();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };

  const getLoadingText = () => {
    if (retryAttempt > 0) {
      return `Retrying... (attempt ${retryAttempt})`;
    }
    return "Analyzing...";
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search any topic to see multiple perspectives..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 text-base"
            disabled={isLoading}
          />
        </div>
        <Button type="submit" size="lg" disabled={isLoading || !searchTerm.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {getLoadingText()}
            </>
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {/* Error Display */}
      {error && !isLoading && (
        <div className={`mt-4 p-4 rounded-lg border ${isNetworkError ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800' : 'bg-destructive/10 border-destructive/20'}`}>
          <div className="flex items-start gap-3">
            {isNetworkError && <WifiOff className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />}
            <div className="flex-1">
              <p className={`text-sm font-medium ${isNetworkError ? 'text-orange-800 dark:text-orange-200' : 'text-destructive'}`}>
                {isNetworkError ? "Connection Issue" : "Search Failed"}
              </p>
              <p className={`text-sm mt-1 ${isNetworkError ? 'text-orange-700 dark:text-orange-300' : 'text-destructive/80'}`}>
                {error}
              </p>
            </div>
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                className="flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 justify-center items-center">
        <span className="text-sm text-muted-foreground">Trending:</span>
        {loadingTopics ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          trendingTopics.map((topic) => (
            <button
              key={topic}
              onClick={() => {
                setSearchTerm(topic);
                onSearch(topic);
              }}
              disabled={isLoading}
              className="text-sm px-3 py-1 rounded-full bg-secondary hover:bg-accent transition-colors disabled:opacity-50"
            >
              {topic}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default TopicSearch;
