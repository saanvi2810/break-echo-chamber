import { TrendingUp, Calendar, Hash } from "lucide-react";
import PerspectiveCard from "./PerspectiveCard";
import type { TopicData, Perspective } from "@/lib/api/perspectives";

interface TrendingTopicDisplayProps {
  topic: TopicData;
  perspectives: Perspective[];
}

const TrendingTopicDisplay = ({ topic, perspectives }: TrendingTopicDisplayProps) => {
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
  );
};

export default TrendingTopicDisplay;
