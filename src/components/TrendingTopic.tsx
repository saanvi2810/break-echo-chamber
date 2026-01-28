import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import TopicSearch from "./TopicSearch";
import TrendingTopicDisplay from "./TrendingTopicDisplay";
import { searchPerspectives, type TopicData, type Perspective } from "@/lib/api/perspectives";

const TrendingTopic = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<TopicData | null>(null);
  const [perspectives, setPerspectives] = useState<Perspective[] | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [lastSearchTopic, setLastSearchTopic] = useState("");
  const [searchError, setSearchError] = useState<string | undefined>();
  const [isNetworkError, setIsNetworkError] = useState(false);

  const handleSearch = useCallback(async (topic: string) => {
    setIsLoading(true);
    setRetryAttempt(0);
    setSearchError(undefined);
    setIsNetworkError(false);
    setLastSearchTopic(topic);

    const result = await searchPerspectives(topic, (attempt) => {
      setRetryAttempt(attempt);
    });

    setIsLoading(false);
    setRetryAttempt(0);

    if (result.error) {
      setSearchError(result.error);
      setIsNetworkError(result.isNetworkError || false);
      
      if (result.retryCount && result.retryCount > 0) {
        toast({
          title: "Search Failed",
          description: `Failed after ${result.retryCount + 1} attempts. ${result.error}`,
          variant: "destructive",
        });
      }
    } else if (result.data) {
      setCurrentTopic(result.data.topic);
      setPerspectives(result.data.perspectives);
      setSearchError(undefined);
      toast({
        title: "Analysis Complete",
        description: `Found perspectives on "${result.data.topic.title}"`,
      });
    }
  }, [toast]);

  const handleRetry = useCallback(() => {
    if (lastSearchTopic) {
      handleSearch(lastSearchTopic);
    }
  }, [lastSearchTopic, handleSearch]);

  return (
    <section id="trending" className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Search Section */}
        <div className="mb-12 animate-fade-in">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-center mb-6">
            Explore Any Topic
          </h2>
          <TopicSearch 
            onSearch={handleSearch} 
            isLoading={isLoading}
            retryAttempt={retryAttempt}
            error={searchError}
            isNetworkError={isNetworkError}
            onRetry={lastSearchTopic ? handleRetry : undefined}
          />
        </div>

        {/* Topic Display - only show when we have results */}
        {currentTopic && perspectives && (
          <TrendingTopicDisplay topic={currentTopic} perspectives={perspectives} />
        )}
      </div>
    </section>
  );
};

export default TrendingTopic;
