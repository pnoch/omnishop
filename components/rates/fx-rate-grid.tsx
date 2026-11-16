import { Platform, useWindowDimensions, View } from "react-native";
import { EXCHANGE_RATES } from "@shared/currency";
import { FxSparklineCard } from "./fx-sparkline-card";

const CURRENCIES = [
  "USD", "EUR", "GBP", "MYR", "AUD", "NZD",
  "CAD", "ZAR", "THB", "SGD", "HKD", "AED",
];

interface FxRateGridProps {
  currentRates: Record<string, number>;
  history: Record<string, (number | null)[]>;
  change: Record<string, number | null>;
}

export function FxRateGrid({ currentRates, history, change }: FxRateGridProps) {
  const currencies = CURRENCIES;
  const { width } = useWindowDimensions();
  const columns =
    Platform.OS === "web" && width >= 1200
      ? 4
      : Platform.OS === "web" && width >= 760
        ? 3
        : 2;

  const rows: string[][] = [];
  for (let i = 0; i < currencies.length; i += columns) {
    rows.push(currencies.slice(i, i + columns));
  }

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 8 }}>
          {row.map((code) => (
            <FxSparklineCard
              key={code}
              currency={code}
              rate={currentRates[code] ?? EXCHANGE_RATES[code] ?? 1}
              // Pass null through: the card renders "No history" for a window
              // with fewer than two valid points. Coercing to 0 claimed
              // measured stability where nothing was measured.
              change={change[code] ?? null}
              history={history[code] ?? []}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
