import { TrendingUp, Calendar, Hash } from "lucide-react";
import PerspectiveCard from "./PerspectiveCard";
import FactCheckSection from "./FactCheckSection";
import type { TopicData, Perspective, FactCheck } from "@/lib/api/perspectives";

interface TrendingTopicDisplayProps {
  topic: TopicData;
  perspectives: Perspective[];
  factChecks?: FactCheck[];
}

const TrendingTopicDisplay = ({ topic, perspectives, factChecks = [] }: TrendingTopicDisplayProps) => {
  return (
    <div>
      {/* Topic Header */}
      <div className="max-w-3xl mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-perspective-center mb-4">
          <TrendingUp className="w-4 h-4" />
          <span>Multi-Perspective Analysis</span>
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
              <a
                key={tag}
                href={`https://twitter.com/search?q=%23${encodeURIComponent(tag.replace(/\s+/g, ''))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
              >
                <Hash className="w-3 h-3" />
                {tag}
              </a>
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

      {/* Fact-Check Section */}
      <div className="max-w-6xl mx-auto">
        <FactCheckSection factChecks={factChecks} />
      </div>
    </div>
  );
};

export default TrendingTopicDisplay;
