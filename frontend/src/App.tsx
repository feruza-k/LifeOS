import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Week from "./pages/Week";
import Calendar from "./pages/Calendar";
import Explore from "./pages/Explore";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import Categories from "./pages/Categories";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/week" element={<Week />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
