import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import GlobalAudioPlayer from "@/components/GlobalAudioPlayer";
import VisitorTracker from "@/components/VisitorTracker";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Builder from "./pages/Builder";
import MySetlists from "./pages/MySetlists";
import Profile from "./pages/Profile";
import JoinSetlist from "./pages/JoinSetlist";
import Browse from "./pages/Browse";
import SetlistPoster from "./pages/SetlistPoster";
import Admin from "./pages/Admin";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Messages from "./pages/Messages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AudioPlayerProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/my-setlists" element={<MySetlists />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/builder/:id" element={<Builder />} />
            <Route path="/join/:token" element={<JoinSetlist />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/setlist/:id" element={<SetlistPoster />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <GlobalAudioPlayer />
          <VisitorTracker />
        </AudioPlayerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
