import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TopicSearchProps {
  onSearch: (topic: string) => void;
  isLoading: boolean;
}

const TopicSearch = ({ onSearch, isLoading }: TopicSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };

  const suggestedTopics = [
    "Climate Change Policy",
    "Immigration Reform",
    "Healthcare Costs",
    "Tech Regulation",
    "Economic Outlook",
  ];

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
              Analyzing...
            </>
          ) : (
            "Search"
          )}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <span className="text-sm text-muted-foreground">Try:</span>
        {suggestedTopics.map((topic) => (
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
        ))}
      </div>
    </div>
  );
};

export default TopicSearch;
