import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import GlobalAudioPlayer from "@/components/GlobalAudioPlayer";
import ReturnToSetlistPill from "@/components/ReturnToSetlistPill";
import VisitorTracker from "@/components/VisitorTracker";
import PresenceBroadcaster from "@/components/PresenceBroadcaster";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import AudioDebugPanel from "@/components/AudioDebugPanel";
import PickHandleModal from "@/components/PickHandleModal";
import UtmCapture from "@/components/UtmCapture";
import NewVersionBanner from "@/components/NewVersionBanner";
import NativeAuthCallback from "@/components/NativeAuthCallback";

// Eagerly load the landing page for fastest FCP/LCP
import Index from "./pages/Index";

// Lazy-load all other routes to reduce initial bundle size
const Auth = lazyWithReload(() => import("./pages/Auth"));
const Builder = lazyWithReload(() => import("./pages/Builder"));
const MySetlists = lazyWithReload(() => import("./pages/MySetlists"));
const Profile = lazyWithReload(() => import("./pages/Profile"));
const JoinSetlist = lazyWithReload(() => import("./pages/JoinSetlist"));
const Browse = lazyWithReload(() => import("./pages/Browse"));
const SetlistPoster = lazyWithReload(() => import("./pages/SetlistPoster"));
const Admin = lazyWithReload(() => import("./pages/Admin"));
const PrivacyPolicy = lazyWithReload(() => import("./pages/PrivacyPolicy"));
const About = lazyWithReload(() => import("./pages/About"));
const Terms = lazyWithReload(() => import("./pages/Terms"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
// PROTOTYPE — the version picker as a page (see src/pages/VersionPicker.tsx).
const VersionPicker = lazyWithReload(() => import("./pages/VersionPicker"));
const ResetPassword = lazyWithReload(() => import("./pages/ResetPassword"));
const Messages = lazyWithReload(() => import("./pages/Messages"));
const Backstage = lazyWithReload(() => import("./pages/Backstage"));
const Unsubscribe = lazyWithReload(() => import("./pages/Unsubscribe"));
const Updates = lazyWithReload(() => import("./pages/Updates"));
const AdminChangelog = lazyWithReload(() => import("./pages/AdminChangelog"));
const AdminBetaNudge = lazyWithReload(() => import("./pages/AdminBetaNudge"));
const AdminNotificationClicks = lazyWithReload(() => import("./pages/AdminNotificationClicks"));
const UserLibrary = lazyWithReload(() => import("./pages/UserLibrary"));
const AudioDiagnostics = lazyWithReload(() => import("./pages/AudioDiagnostics"));
const SongPage = lazyWithReload(() => import("./pages/Song"));
const Songbook = lazyWithReload(() => import("./pages/Songbook"));
const SongFeature = lazyWithReload(() => import("./pages/SongFeature"));

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
                <Route path="/about" element={<About />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/backstage" element={<Backstage />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/updates" element={<Updates />} />
                <Route path="/admin/changelog" element={<AdminChangelog />} />
                <Route path="/admin/email/beta-nudge" element={<AdminBetaNudge />} />
                <Route path="/admin/notification-clicks" element={<AdminNotificationClicks />} />
                <Route path="/user/:userId" element={<UserLibrary />} />
                <Route path="/audio-diag" element={<AudioDiagnostics />} />
                <Route path="/song/:songId" element={<SongPage />} />
                <Route path="/versions/:slug" element={<VersionPicker />} />
                <Route path="/songbook" element={<Songbook />} />
                <Route path="/songbook/:slug" element={<SongFeature />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>

            <GlobalAudioPlayer />
            <ReturnToSetlistPill />
            <NativeAuthCallback />
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
