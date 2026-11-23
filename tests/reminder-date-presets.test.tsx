// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Platform: { OS: "web" },
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, accessibilityState, style }: any) =>
      React.createElement(
        "button",
        {
          "aria-label": accessibilityLabel,
          "aria-checked": accessibilityState?.checked,
          onClick: onPress,
        },
        children,
      ),
  };
});

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({
    primary: "#0F52BA",
    foreground: "#111",
    muted: "#888",
    surface: "#fff",
    border: "#ddd",
  }),
}));

import {
  ReminderDatePresets,
  reminderPresets,
} from "@/components/ui/reminder-date-presets";

describe("reminderPresets", () => {
  it("returns tomorrow, one week, and one month at midnight", () => {
    const now = new Date(2026, 10, 23, 15, 30, 0);
    const presets = reminderPresets(now);
    expect(presets.map((preset) => preset.label)).toEqual([
      "Tomorrow",
      "In 1 week",
      "In 1 month",
    ]);
    expect(presets[0]!.date.getDate()).toBe(24);
    expect(presets[1]!.date.getDate()).toBe(30);
    expect(presets[2]!.date.getMonth()).toBe(11);
    for (const preset of presets) {
      expect(preset.date.getHours()).toBe(0);
      expect(preset.date.getMinutes()).toBe(0);
    }
  });
});

describe("ReminderDatePresets", () => {
  afterEach(cleanup);

  it("marks the matching preset selected and applies a choice", () => {
    const now = new Date();
    const tomorrow = reminderPresets(now)[0]!.date;
    const onChange = vi.fn();
    render(<ReminderDatePresets value={tomorrow} onChange={onChange} />);

    expect(screen.getByLabelText(/^Remind me tomorrow/).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText(/^Remind me in 1 week/).getAttribute("aria-checked")).toBe("false");

    fireEvent.click(screen.getByLabelText(/^Remind me in 1 week/));
    expect(onChange).toHaveBeenCalledTimes(1);
    const picked = onChange.mock.calls[0]![0] as Date;
    expect(picked.getTime()).toBe(reminderPresets(now)[1]!.date.getTime());
  });

  it("does not offer a preset before the minimum date", () => {
    const week = reminderPresets()[1]!.date;
    const onChange = vi.fn();
    render(
      <ReminderDatePresets value={week} minimumDate={week} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText(/^Remind me tomorrow/));
    expect((onChange.mock.calls[0]![0] as Date).getTime()).toBe(week.getTime());
  });
});
