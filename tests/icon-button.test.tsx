// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { forwardRef } from "react";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Pressable: forwardRef(function Pressable(
    {
      children,
      onPress,
      onHoverIn,
      onHoverOut,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      disabled,
      style,
    }: any,
    ref,
  ) {
    const resolved = typeof style === "function" ? style({ pressed: false }) : style;
    const flat = Array.isArray(resolved) ? Object.assign({}, ...resolved) : resolved;
    return React.createElement(
      "button",
      {
        ref,
        "aria-label": accessibilityLabel,
        "aria-disabled": accessibilityState?.disabled,
        role: accessibilityRole,
        disabled,
        onClick: onPress,
        onMouseEnter: onHoverIn,
        onMouseLeave: onHoverOut,
        "data-bg": flat?.backgroundColor,
        "data-size": flat?.width,
      },
      children,
    );
  }),
}));

vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ primary: "#0F52BA", foreground: "#111", muted: "#888" }),
}));

vi.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: ({ name }: { name: string }) => React.createElement("i", { "data-icon": name }),
}));

import { IconButton } from "@/components/ui/icon-button";

describe("IconButton", () => {
  afterEach(cleanup);

  it("exposes a label, native tooltip, and 44px target", () => {
    render(<IconButton icon="square.and.arrow.up" label="Share product" onPress={() => {}} />);
    const button = screen.getByLabelText("Share product");
    expect(button.getAttribute("title")).toBe("Share product");
    expect(button.getAttribute("data-size")).toBe("44");
    expect(button.getAttribute("data-bg")).toBe("transparent");
  });

  it("tints on hover and clears on leave", () => {
    render(<IconButton icon="pencil" label="Edit product" onPress={() => {}} />);
    const button = screen.getByLabelText("Edit product");
    fireEvent.mouseEnter(button);
    expect(button.getAttribute("data-bg")).toBe("#0F52BA14");
    fireEvent.mouseLeave(button);
    expect(button.getAttribute("data-bg")).toBe("transparent");
  });

  it("calls onPress and respects disabled", () => {
    const onPress = vi.fn();
    const { rerender } = render(
      <IconButton icon="pencil" label="Edit product" onPress={onPress} />,
    );
    fireEvent.click(screen.getByLabelText("Edit product"));
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(<IconButton icon="pencil" label="Edit product" onPress={onPress} disabled />);
    fireEvent.click(screen.getByLabelText("Edit product"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
