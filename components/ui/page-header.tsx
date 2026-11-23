import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { IconButton } from "@/components/ui/icon-button";
import { useColors } from "@/hooks/use-colors";
import { Heading } from "@/components/ui/heading";

export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
  backLabel = "Go back",
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  backLabel?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      {onBack && (
        <IconButton
          icon="chevron.left"
          label={backLabel}
          onPress={onBack}
          color={colors.primary}
          style={{ marginLeft: -12 }}
        />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Heading
          level={1}
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
          numberOfLines={2}
        >
          {title}
        </Heading>
        {subtitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}
