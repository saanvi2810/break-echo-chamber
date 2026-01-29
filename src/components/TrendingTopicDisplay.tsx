import { useState } from "react";
import { TrendingUp, Calendar, Hash, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import PerspectiveCard from "./PerspectiveCard";
import type { TopicData, Perspective } from "@/lib/api/perspectives";

interface TrendingTopicDisplayProps {
  topic: TopicData;
  perspectives: Perspective[];
}

const INITIAL_SHOW_COUNT = 3;

const perspectiveConfig = {
  left: {
    title: "Left-Leaning",
    color: "text-perspective-left",
    bgColor: "bg-perspective-left/10",
    borderColor: "border-perspective-left",
  },
  center: {
    title: "Center",
    color: "text-perspective-center",
    bgColor: "bg-perspective-center/10",
    borderColor: "border-perspective-center",
  },
  right: {
    title: "Right-Leaning",
    color: "text-perspective-right",
    bgColor: "bg-perspective-right/10",
    borderColor: "border-perspective-right",
  },
};

const TrendingTopicDisplay = ({ topic, perspectives }: TrendingTopicDisplayProps) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    left: false,
    center: false,
    right: false,
  });

  // Group perspectives by type
  const groupedPerspectives = perspectives.reduce((acc, p) => {
    if (!acc[p.perspective]) {
      acc[p.perspective] = [];
    }
    acc[p.perspective].push(p);
    return acc;
  }, {} as Record<string, Perspective[]>);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderPerspectiveSection = (type: 'left' | 'center' | 'right', index: number) => {
    const articles = groupedPerspectives[type] || [];
    const config = perspectiveConfig[type];
    const isExpanded = expandedSections[type];
    const displayedArticles = isExpanded ? articles : articles.slice(0, INITIAL_SHOW_COUNT);
    const hasMore = articles.length > INITIAL_SHOW_COUNT;

    if (articles.length === 0) return null;

    return (
      <div 
        key={type} 
        className="animate-fade-in"
        style={{ animationDelay: `${0.2 + index * 0.1}s` }}
      >
        <div className={`flex items-center gap-2 mb-4 pb-2 border-b-2 ${config.borderColor}`}>
          <h3 className={`font-serif text-xl font-bold ${config.color}`}>
            {config.title}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-4">
          {displayedArticles.map((perspective, idx) => (
            <PerspectiveCard
              key={`${type}-${perspective.articleUrl}-${idx}`}
              {...perspective}
              animationDelay={`${0.3 + idx * 0.05}s`}
            />
          ))}
        </div>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSection(type)}
            className={`mt-4 w-full ${config.color} hover:${config.bgColor}`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Show {articles.length - INITIAL_SHOW_COUNT} more
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

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
                target="_top"
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

      {/* Perspective Sections - 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {(['left', 'center', 'right'] as const).map((type, index) => 
          renderPerspectiveSection(type, index)
        )}
      </div>
    </div>
  );
};

export default TrendingTopicDisplay;
