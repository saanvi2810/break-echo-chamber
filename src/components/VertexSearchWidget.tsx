import { useEffect } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gen-search-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        configId: string;
        triggerId: string;
      }, HTMLElement>;
    }
  }
}

interface VertexSearchWidgetProps {
  onSearch?: (query: string) => void;
}

const VertexSearchWidget = ({ onSearch }: VertexSearchWidgetProps) => {
  useEffect(() => {
    // Load the Vertex AI Search widget script
    const script = document.createElement('script');
    script.src = 'https://cloud.google.com/ai/gen-app-builder/client?hl=en_US';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
      const existingScript = document.querySelector('script[src*="gen-app-builder"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <gen-search-widget
        configId="086433e2-c2ab-4d73-9386-22eb1177db85"
        triggerId="searchWidgetTrigger"
      />
      
      <div className="relative">
        <input
          type="text"
          placeholder="Search any topic to see multiple perspectives..."
          id="searchWidgetTrigger"
          className="w-full h-12 pl-11 pr-4 text-base rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      
      <p className="mt-3 text-sm text-muted-foreground text-center">
        Powered by Google Vertex AI Search
      </p>
    </div>
  );
};

export default VertexSearchWidget;
