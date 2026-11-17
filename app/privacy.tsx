import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { goBackOrHome } from "@/lib/navigation";
import { getSupportEmail } from "@/lib/legal-links";

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, lineHeight: 21 }}>
        {children}
      </Text>
    </View>
  );
}

// Public privacy policy. Both the App Store and Play Store require a reachable
// privacy-policy URL, and the Settings screen links here. Keep the content
// accurate: it describes what the app actually stores and sends.
export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const updated = "September 18, 2026";

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => goBackOrHome(router)}
            style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", marginLeft: -8 }}
            accessibilityLabel="Back"
            accessibilityRole="button"
          >
            <IconSymbol name="chevron.left" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ color: colors.foreground, fontSize: 24, fontWeight: "800" }}>
            Privacy Policy
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
          Last updated {updated}
        </Text>

        <Section colors={colors} title="What we store">
          Your watchlist, price alerts, back-order reminders, restock watches, and
          app settings are stored locally on your device. If you create an
          account, they also sync to our server so they are available on your
          other devices.
        </Section>

        <Section colors={colors} title="Account data">
          If you sign in, we store your email address, an optional display name,
          a hashed password (never the password itself), and the devices you have
          signed in from. We use this only to authenticate you and to deliver the
          notifications you asked for.
        </Section>

        <Section colors={colors} title="Notifications">
          Price, restock, reminder, and digest notifications are generated from
          your own watchlist and alert settings. On mobile we register a push
          token with Expo; on the web we store a browser push subscription. You
          can disable notifications at any time in Settings.
        </Section>

        <Section colors={colors} title="Price data">
          Prices are fetched from public distributor websites. We do not send
          your watchlist or account details to those sites — only the product
          model being looked up.
        </Section>

        <Section colors={colors} title="What we do not do">
          We do not sell your data, and we do not use third-party advertising or
          tracking SDKs. We do not collect your contacts, photos, or precise
          location.
        </Section>

        <Section colors={colors} title="Data retention and deletion">
          You can delete your account and all associated data from Settings →
          Account → Delete Account. Deleting your account removes your synced
          watchlist, alerts, reminders, settings, and device records from our
          server.
        </Section>

        <Section colors={colors} title="Contact">
          {`Questions about this policy: ${getSupportEmail()}`}
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}
