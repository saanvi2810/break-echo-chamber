import { TrendingUp, Calendar, Hash } from "lucide-react";
import PerspectiveCard from "./PerspectiveCard";

const TrendingTopic = () => {
  const topic = {
    title: "AI Regulation Debate Heats Up",
    description: "Global leaders clash over proposed artificial intelligence safety frameworks",
    date: "January 27, 2026",
    tags: ["Technology", "Politics", "Economy"],
  };

  const perspectives = [
    {
      perspective: "left" as const,
      label: "Progressive View",
      outlet: "The Progressive Herald",
      headline: "Tech Giants Lobby Against Worker Protections in AI Bill",
      summary: "Critics argue that proposed AI legislation prioritizes corporate interests while failing to address automation's impact on working families and marginalized communities.",
      timeAgo: "2 hours ago",
      claims: [
        {
          text: "AI could displace 40% of jobs in the next decade",
          status: "disputed" as const,
          source: "MIT Technology Review",
          sourceUrl: "https://example.com/source1",
        },
        {
          text: "Major tech companies spent $50M lobbying against the bill",
          status: "verified" as const,
          source: "OpenSecrets",
          sourceUrl: "https://example.com/source2",
        },
      ],
      articleUrl: "#",
    },
    {
      perspective: "center" as const,
      label: "Balanced Analysis",
      outlet: "The Independent Journal",
      headline: "AI Safety Framework: Weighing Innovation Against Regulation",
      summary: "The proposed legislation attempts to balance technological advancement with public safety concerns, though experts remain divided on its potential effectiveness.",
      timeAgo: "3 hours ago",
      claims: [
        {
          text: "The bill includes provisions for both innovation incentives and safety requirements",
          status: "verified" as const,
          source: "Congressional Research Service",
          sourceUrl: "https://example.com/source3",
        },
        {
          text: "Similar frameworks have been implemented in the EU",
          status: "verified" as const,
          source: "European Commission",
          sourceUrl: "https://example.com/source4",
        },
      ],
      articleUrl: "#",
    },
    {
      perspective: "right" as const,
      label: "Conservative View",
      outlet: "The Market Tribune",
      headline: "Overreaching AI Regulations Threaten American Competitiveness",
      summary: "Business leaders warn that excessive government intervention could stifle innovation and push AI development overseas, benefiting competitors like China.",
      timeAgo: "4 hours ago",
      claims: [
        {
          text: "China has invested $15B in AI development this year alone",
          status: "verified" as const,
          source: "CSIS Analysis",
          sourceUrl: "https://example.com/source5",
        },
        {
          text: "The regulations would cost businesses $200B annually",
          status: "false" as const,
          source: "FactCheck.org",
          sourceUrl: "https://example.com/source6",
        },
      ],
      articleUrl: "#",
    },
  ];

  return (
    <section id="trending" className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Topic Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-perspective-center mb-4">
            <TrendingUp className="w-4 h-4" />
            <span>Today's Trending Topic</span>
          </div>
          
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4 animate-fade-in">
            {topic.title}
          </h2>
          
          <p className="text-muted-foreground mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {topic.description}
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{topic.date}</span>
            </div>
            <div className="flex items-center gap-2">
              {topic.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-xs font-medium"
                >
                  <Hash className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Perspective Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {perspectives.map((perspective, index) => (
            <PerspectiveCard
              key={perspective.perspective}
              {...perspective}
              animationDelay={`${0.3 + index * 0.1}s`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="max-w-2xl mx-auto mt-12 p-6 bg-card rounded-lg border border-border animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <h3 className="font-serif text-lg font-semibold mb-4 text-center">
            Understanding the Perspectives
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 rounded-full bg-perspective-left" />
              <div>
                <p className="font-medium">Progressive</p>
                <p className="text-xs text-muted-foreground">Left-leaning sources</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 rounded-full bg-perspective-center" />
              <div>
                <p className="font-medium">Balanced</p>
                <p className="text-xs text-muted-foreground">Centrist sources</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 rounded-full bg-perspective-right" />
              <div>
                <p className="font-medium">Conservative</p>
                <p className="text-xs text-muted-foreground">Right-leaning sources</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendingTopic;
