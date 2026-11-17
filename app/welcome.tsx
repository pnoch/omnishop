import { router } from "expo-router";
import { ConciergeScreen } from "@/components/onboarding/concierge-screen";
import { goBackOrHome } from "@/lib/navigation";

export default function WelcomeScreen() {
  return <ConciergeScreen onComplete={() => goBackOrHome(router)} />;
}
