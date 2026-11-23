import { useEffect, useRef, useSyncExternalStore } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import {
  dismissWebAlert,
  getWebAlertServerSnapshot,
  getWebAlertSnapshot,
  resolveWebAlert,
  subscribeWebAlerts,
  type WebAlertButton,
} from "@/lib/web-alert-store";

function buttonColors(
  button: WebAlertButton,
  colors: ReturnType<typeof useColors>,
): { background: string; border: string; text: string } {
  if (button.style === "destructive") {
    return {
      background: colors.error + "14",
      border: colors.error + "55",
      text: colors.error,
    };
  }
  if (button.style === "cancel") {
    return {
      background: "transparent",
      border: colors.border,
      text: colors.foreground,
    };
  }
  return {
    background: colors.primary,
    border: colors.primary,
    text: "#fff",
  };
}

/**
 * Renders the queued web alert as an in-app dialog. On native, `showAlert`
 * uses the system alert and this host renders nothing.
 */
export function WebAlertHost() {
  const colors = useColors();
  const state = useSyncExternalStore(
    subscribeWebAlerts,
    getWebAlertSnapshot,
    getWebAlertServerSnapshot,
  );
  const alert = state.current;
  const focusRef = useRef<unknown>(null);

  const cancelIndex = alert
    ? alert.buttons.findIndex((button) => button.style === "cancel")
    : -1;
  const focusIndex = cancelIndex >= 0 ? cancelIndex : 0;

  useEffect(() => {
    if (Platform.OS !== "web" || !alert) return;
    const node = focusRef.current as { focus?: () => void } | null;
    node?.focus?.();
  }, [alert]);

  useEffect(() => {
    if (Platform.OS !== "web" || !alert || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismissWebAlert();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alert]);

  if (Platform.OS !== "web" || !alert) return null;

  const hasCancel = cancelIndex >= 0;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismissWebAlert}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "rgba(0,0,0,0.55)",
        }}
        accessibilityViewIsModal
      >
        <Pressable
          onPress={hasCancel ? dismissWebAlert : () => resolveWebAlert()}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />
        <View
          accessibilityRole="alert"
          accessibilityLabel={alert.title}
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 20,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}
          >
            {alert.title}
          </Text>
          {alert.message ? (
            <Text
              style={{
                color: colors.muted,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 8,
              }}
            >
              {alert.message}
            </Text>
          ) : null}
          <View style={{ marginTop: 18, gap: 8 }}>
            {alert.buttons.map((button, index) => {
              const palette = buttonColors(button, colors);
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  ref={index === focusIndex ? (focusRef as never) : undefined}
                  onPress={() => resolveWebAlert(button)}
                  accessibilityRole="button"
                  accessibilityLabel={button.text}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: palette.border,
                    backgroundColor: palette.background,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
