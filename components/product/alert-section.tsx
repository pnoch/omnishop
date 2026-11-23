import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, Keyboard, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { createPriceAlert } from "@/lib/create-price-alert";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";
import { CURRENCY_SYMBOLS, formatPrice } from "@shared/currency";
import type { PriceAlert } from "@/lib/types";

export function AlertSection({ productId, productName, displayCurrency = "USD", onAdded }: { productId: string; productName?: string; displayCurrency?: string; onAdded?: (alert: PriceAlert) => void }) {
  const colors = useColors();
  const { showToast } = useToast();
  const [price, setPrice] = useState("");
  const [adding, setAdding] = useState(false);
  const currency = displayCurrency;
  const onAdd = async () => {
    Keyboard.dismiss();
    // Guard against double-submit: the button and onSubmitEditing both call
    // this, and each call would mint a new alert id.
    if (adding) return;
    // Guard before the first await: setting it afterwards let a double-tap (or
    // the button plus onSubmitEditing) through the check twice and mint two
    // identical alerts.
    setAdding(true);
    try {
      const targetPrice = parseFloat(price);
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) { showAlert("Invalid price", "Please enter a valid target price."); return; }
      // The alert is saved even when notifications are denied; scheduling is
      // best-effort and the toast tells the user how to turn alerts on.
      const result = await createPriceAlert({
        productId,
        productName: productName ?? "Product",
        targetPrice,
        currency,
      });
      if (result.reason === "duplicate") {
        setPrice("");
        showToast("That alert already exists", "info");
        return;
      }
      if (!result.saved || !result.alert) {
        showAlert(
          "Couldn't create alert",
          "We couldn't save your price alert. Please try again.",
        );
        return;
      }
      // Let the parent refresh its alerts state so the Distributor Targets
      // table reflects this product-wide target immediately.
      onAdded?.(result.alert);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        result.scheduled
          ? `Alert created — watching for ${formatPrice(targetPrice, currency)}`
          : "Alert saved — enable notifications to get alerted",
        result.scheduled ? "success" : "info",
      );
      setPrice("");
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't create alert", "We couldn't save your price alert. Please try again.");
    } finally {
      setAdding(false);
    }
  };
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>Price Alert</Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{CURRENCY_SYMBOLS[currency] ?? currency}</Text>
        <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Target price" placeholderTextColor={colors.muted} returnKeyType="done" onSubmitEditing={onAdd} style={{ flex: 1, paddingVertical: 10, marginLeft: 6, color: colors.foreground }} />
      </View>
      <TouchableOpacity activeOpacity={0.85} onPress={onAdd} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 10, marginTop: 10, alignItems: "center", justifyContent: "center", minHeight: 44 }} accessibilityLabel="Add price alert" accessibilityRole="button"><Text style={{ color: "#fff", fontWeight: "600" }}>Add Alert</Text></TouchableOpacity>
    </View>
  );
}
