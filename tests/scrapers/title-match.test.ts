import { describe, expect, it } from "vitest";
import { titleMatchesModel } from "../../lib/scrapers/model-match";

// `matchesModel` intentionally tolerates SKU suffixes so a card reading
// "MikroTikCRS326-24G-2S+IN" still matches. Search-result titles need a stricter
// rule: the requested model must not continue into a different variant, and
// accessories or service plans must never be treated as the product.
describe("titleMatchesModel", () => {
  it("matches when the title names the requested model", () => {
    expect(
      titleMatchesModel(
        "Ubiquiti UniFi U7 Pro WiFi 7 Access Point - U7-Pro",
        "U7-Pro",
      ),
    ).toBe(true);
    expect(
      titleMatchesModel(
        "Ubiquiti UniFi Flex Indoor / Outdoor 5 Port Switch - USW-Flex",
        "USW-Flex",
      ),
    ).toBe(true);
    expect(
      titleMatchesModel(
        "Ubiquiti UniFi Cloud Gateway Ultra - UCG-Ultra - UK Converter",
        "UCG-Ultra",
      ),
    ).toBe(true);
  });

  it("rejects sibling variants the model is a prefix of", () => {
    expect(
      titleMatchesModel(
        "Ubiquiti UniFi U7 Pro Wall WiFi 7 Access Point - U7-Pro-Wall",
        "U7-Pro",
      ),
    ).toBe(false);
    expect(
      titleMatchesModel(
        "OPEN BOX Ubiquiti UniFi Flex Mini 5 Port Network Switch - USW-FLEX-Mini",
        "USW-Flex",
      ),
    ).toBe(false);
  });

  it("accepts the variant when it is the requested model", () => {
    expect(
      titleMatchesModel(
        "Ubiquiti UniFi U7 Pro Wall WiFi 7 Access Point - U7-Pro-Wall",
        "U7-Pro-Wall",
      ),
    ).toBe(true);
    expect(
      titleMatchesModel(
        "Ubiquiti UniFi Flex Mini 5 Port Network Switch - USW-FLEX-Mini",
        "USW-Flex-Mini",
      ),
    ).toBe(true);
  });

  it("rejects accessories, service plans, and used stock", () => {
    expect(
      titleMatchesModel("Ubiquiti UniFi U7 Pro Wall Paintable Flush Mount", "U7-Pro"),
    ).toBe(false);
    expect(
      titleMatchesModel("Ubiquiti UI CARE for UCG-Ultra", "UCG-Ultra"),
    ).toBe(false);
    expect(
      titleMatchesModel("OPEN BOX Ubiquiti UniFi U7 Pro - U7-Pro", "U7-Pro"),
    ).toBe(false);
  });

  it("matches models whose separators differ from the title", () => {
    expect(
      titleMatchesModel("Ubiquiti UniFi U6-Plus WiFi 6 Access Point - U6+", "U6+"),
    ).toBe(true);
  });
});
