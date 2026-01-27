import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrendingTopic from "@/components/TrendingTopic";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrendingTopic />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
