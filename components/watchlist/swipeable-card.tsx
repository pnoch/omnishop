import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";

const ACTION_WIDTH = 72;
const OPEN_THRESHOLD = 40;
const OPEN_VELOCITY = 0.4;

type ActionButtonProps = {
  label: string;
  icon: IconSymbolName;
  color: string;
  background: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  onPress: () => void;
};

function ActionButton({
  label,
  icon,
  color,
  background,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => ({
        width: ACTION_WIDTH,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        backgroundColor: background,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <IconSymbol name={icon} size={20} color={color} />
      <Text style={{ fontSize: 12, fontWeight: "600", color }}>{label}</Text>
    </Pressable>
  );
}

export function SwipeableCard({
  children,
  onDelete,
  onToggleAlert,
  onToggleAcquired,
  isAcquired,
  hasAlert,
  enabled = true,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onToggleAlert?: () => void;
  onToggleAcquired?: () => void;
  isAcquired?: boolean;
  hasAlert?: boolean;
  enabled?: boolean;
}) {
  const colors = useColors();
  const [translateX] = useState(() => new Animated.Value(0));
  const startX = useRef(0);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);

  const showAlert = onToggleAlert != null;
  const showAcquired = onToggleAcquired != null;
  const width = ACTION_WIDTH * (1 + (showAlert ? 1 : 0) + (showAcquired ? 1 : 0));

  const animateTo = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && !openRef.current && Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      openRef.current = nextOpen;
      setOpen(nextOpen);
      Animated.spring(translateX, {
        toValue: nextOpen ? -width : 0,
        useNativeDriver: true,
        tension: 68,
        friction: 11,
        overshootClamping: true,
      }).start();
    },
    [translateX, width],
  );

  const close = useCallback(() => animateTo(false), [animateTo]);

  useEffect(() => {
    if (!enabled && openRef.current) animateTo(false);
  }, [animateTo, enabled]);

  // The action stack changes width when the available actions change; keep the
  // open offset in sync instead of leaving a gap.
  useEffect(() => {
    if (openRef.current) translateX.setValue(-width);
  }, [translateX, width]);

  // The callbacks only run for touch events, never during render, but the
  // compiler rule cannot see through PanResponder.create.
  // eslint-disable-next-line react-hooks/refs
  const panResponder = PanResponder.create({
        // Capture the touch before the row's own Pressable does while open, so
        // a tap or a rightward drag closes the actions.
        onStartShouldSetPanResponderCapture: () => enabled && openRef.current,
        onStartShouldSetPanResponder: () => enabled && openRef.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          enabled &&
          Math.abs(gesture.dx) > 6 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderGrant: () => {
          startX.current = openRef.current ? -width : 0;
          translateX.stopAnimation((value) => {
            startX.current = value;
          });
        },
        onPanResponderMove: (_event, gesture) => {
          const next = Math.min(0, Math.max(-width, startX.current + gesture.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
            animateTo(false);
            return;
          }
          const next = startX.current + gesture.dx;
          const shouldOpen =
            gesture.vx > OPEN_VELOCITY
              ? false
              : gesture.vx < -OPEN_VELOCITY
                ? true
                : next < -width / 2;
          const clamped = Math.min(0, Math.max(-width, next));
          translateX.setValue(clamped);
          animateTo(shouldOpen && clamped <= -OPEN_THRESHOLD);
        },
    onPanResponderTerminate: () => {
      animateTo(openRef.current);
    },
  });

  const actionsOpacity = translateX.interpolate({
    inputRange: [-width, -40, 0],
    outputRange: [1, 0.6, 0],
    extrapolate: "clamp",
  });
  const actionsScale = translateX.interpolate({
    inputRange: [-width, -20, 0],
    outputRange: [1, 0.85, 0.7],
    extrapolate: "clamp",
  });

  return (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: colors.error + "18",
      }}
    >
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width,
          flexDirection: "row",
          opacity: actionsOpacity,
          transform: [{ scale: actionsScale }],
        }}
      >
        {showAlert && (
          <ActionButton
            label={hasAlert ? "Muted" : "Alert"}
            icon="bell.fill"
            color={colors.primary}
            background={colors.primary + "1A"}
            accessibilityLabel={
              hasAlert ? "Manage price alert" : "Set price alert"
            }
            accessibilityHint="Opens this product to set a price alert"
            onPress={() => {
              close();
              onToggleAlert?.();
            }}
          />
        )}
        {showAcquired && (
          <ActionButton
            label={isAcquired ? "Owned" : "Want"}
            icon="checkmark.circle.fill"
            color={colors.success}
            background={colors.success + "1A"}
            accessibilityLabel={
              isAcquired ? "Mark as not acquired" : "Mark as acquired"
            }
            accessibilityHint="Toggles whether you own this product"
            onPress={() => {
              close();
              onToggleAcquired?.();
            }}
          />
        )}
        <ActionButton
          label="Remove"
          icon="trash.fill"
          color="#fff"
          background={colors.error}
          accessibilityLabel="Remove from watchlist"
          accessibilityHint="Removes this product from your watchlist"
          onPress={() => {
            if (Platform.OS !== "web") {
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
            }
            close();
            onDelete();
          }}
        />
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
