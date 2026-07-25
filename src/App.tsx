import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import DjIntroOverlay from "@/components/DjIntroOverlay";
import GlobalAudioPlayer from "@/components/GlobalAudioPlayer";
import ReturnToSetlistPill from "@/components/ReturnToSetlistPill";
import VisitorTracker from "@/components/VisitorTracker";
import PresenceBroadcaster from "@/components/PresenceBroadcaster";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import AudioDebugPanel from "@/components/AudioDebugPanel";
import PickHandleModal from "@/components/PickHandleModal";
import UtmCapture from "@/components/UtmCapture";
import NewVersionBanner from "@/components/NewVersionBanner";

// Eagerly load the landing page for fastest FCP/LCP
import Index from "./pages/Index";

// Lazy-load all other routes to reduce initial bundle size
const Auth = lazy(() => import("./pages/Auth"));
const Builder = lazy(() => import("./pages/Builder"));
const MySetlists = lazy(() => import("./pages/MySetlists"));
const Profile = lazy(() => import("./pages/Profile"));
const JoinSetlist = lazy(() => import("./pages/JoinSetlist"));
const Browse = lazy(() => import("./pages/Browse"));
const SetlistPoster = lazy(() => import("./pages/SetlistPoster"));
const Admin = lazy(() => import("./pages/Admin"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Messages = lazy(() => import("./pages/Messages"));
const Backstage = lazy(() => import("./pages/Backstage"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Updates = lazy(() => import("./pages/Updates"));
const AdminChangelog = lazy(() => import("./pages/AdminChangelog"));
const AdminBetaNudge = lazy(() => import("./pages/AdminBetaNudge"));
const AdminNotificationClicks = lazy(() => import("./pages/AdminNotificationClicks"));
const UserLibrary = lazy(() => import("./pages/UserLibrary"));
const AudioDiagnostics = lazy(() => import("./pages/AudioDiagnostics"));
const SongPage = lazy(() => import("./pages/Song"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AudioPlayerProvider>
            <UtmCapture />
            <Suspense fallback={null}>
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
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/backstage" element={<Backstage />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/updates" element={<Updates />} />
                <Route path="/admin/changelog" element={<AdminChangelog />} />
                <Route path="/admin/email/beta-nudge" element={<AdminBetaNudge />} />
                <Route path="/admin/notification-clicks" element={<AdminNotificationClicks />} />
                <Route path="/user/:userId" element={<UserLibrary />} />
                <Route path="/audio-diag" element={<AudioDiagnostics />} />
                <Route path="/song/:songId" element={<SongPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>

            <GlobalAudioPlayer />
            <DjIntroOverlay />
            <ReturnToSetlistPill />
            <VisitorTracker />
            <PresenceBroadcaster />
            <PwaInstallBanner />
            <AudioDebugPanel />
            <PickHandleModal />
            <NewVersionBanner />
          </AudioPlayerProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
