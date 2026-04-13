import { usePresence } from "@/hooks/usePresence";

/** Invisible component that broadcasts presence */
const PresenceBroadcaster = () => {
  usePresence();
  return null;
};

export default PresenceBroadcaster;
