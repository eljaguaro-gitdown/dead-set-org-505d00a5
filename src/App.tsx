import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Builder from "./pages/Builder";
import MySetlists from "./pages/MySetlists";
import JoinSetlist from "./pages/JoinSetlist";
import Browse from "./pages/Browse";
import SetlistPoster from "./pages/SetlistPoster";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/builder/:id" element={<Builder />} />
          <Route path="/join/:token" element={<JoinSetlist />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/setlist/:id" element={<SetlistPoster />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
