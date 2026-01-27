import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import TopicSearch from "./TopicSearch";
import TrendingTopicDisplay from "./TrendingTopicDisplay";
import { searchPerspectives, type TopicData, type Perspective } from "@/lib/api/perspectives";

const TrendingTopic = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<TopicData | null>(null);
  const [perspectives, setPerspectives] = useState<Perspective[] | null>(null);

  // Default demo data
  const defaultTopic: TopicData = {
    title: "AI Regulation Debate Heats Up",
    description: "Global leaders clash over proposed artificial intelligence safety frameworks",
    date: "January 27, 2026",
    tags: ["Technology", "Politics", "Economy"],
  };

  const defaultPerspectives: Perspective[] = [
    {
      perspective: "left",
      label: "Progressive View",
      outlet: "The Progressive Herald",
      headline: "Tech Giants Lobby Against Worker Protections in AI Bill",
      summary: "Critics argue that proposed AI legislation prioritizes corporate interests while failing to address automation's impact on working families and marginalized communities.",
      timeAgo: "2 hours ago",
      claims: [
        {
          text: "AI could displace 40% of jobs in the next decade",
          status: "disputed",
          source: "MIT Technology Review",
          sourceUrl: "https://example.com/source1",
        },
        {
          text: "Major tech companies spent $50M lobbying against the bill",
          status: "verified",
          source: "OpenSecrets",
          sourceUrl: "https://example.com/source2",
        },
      ],
      articleUrl: "#",
    },
    {
      perspective: "center",
      label: "Balanced Analysis",
      outlet: "The Independent Journal",
      headline: "AI Safety Framework: Weighing Innovation Against Regulation",
      summary: "The proposed legislation attempts to balance technological advancement with public safety concerns, though experts remain divided on its potential effectiveness.",
      timeAgo: "3 hours ago",
      claims: [
        {
          text: "The bill includes provisions for both innovation incentives and safety requirements",
          status: "verified",
          source: "Congressional Research Service",
          sourceUrl: "https://example.com/source3",
        },
        {
          text: "Similar frameworks have been implemented in the EU",
          status: "verified",
          source: "European Commission",
          sourceUrl: "https://example.com/source4",
        },
      ],
      articleUrl: "#",
    },
    {
      perspective: "right",
      label: "Conservative View",
      outlet: "The Market Tribune",
      headline: "Overreaching AI Regulations Threaten American Competitiveness",
      summary: "Business leaders warn that excessive government intervention could stifle innovation and push AI development overseas, benefiting competitors like China.",
      timeAgo: "4 hours ago",
      claims: [
        {
          text: "China has invested $15B in AI development this year alone",
          status: "verified",
          source: "CSIS Analysis",
          sourceUrl: "https://example.com/source5",
        },
        {
          text: "The regulations would cost businesses $200B annually",
          status: "false",
          source: "FactCheck.org",
          sourceUrl: "https://example.com/source6",
        },
      ],
      articleUrl: "#",
    },
  ];

  const handleSearch = async (topic: string) => {
    setIsLoading(true);
    try {
      const result = await searchPerspectives(topic);
      setCurrentTopic(result.topic);
      setPerspectives(result.perspectives);
      toast({
        title: "Analysis Complete",
        description: `Found perspectives on "${result.topic.title}"`,
      });
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Failed to analyze topic. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const displayTopic = currentTopic || defaultTopic;
  const displayPerspectives = perspectives || defaultPerspectives;

  return (
    <section id="trending" className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Search Section */}
        <div className="mb-12 animate-fade-in">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-center mb-6">
            Explore Any Topic
          </h2>
          <TopicSearch onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Topic Display */}
        <TrendingTopicDisplay topic={displayTopic} perspectives={displayPerspectives} />
      </div>
    </section>
  );
};

export default TrendingTopic;
