/**
 * Reviewed manufacturer product pages used as a reliable source for product
 * photos when distributor pages are stale, search URLs, or blocked.
 *
 * The server fetches the page once, extracts its og:image, and caches the
 * resulting image URL per product. These pages are trusted by construction,
 * so the distributor-host allowlist and page-title validation are skipped.
 */
export const PRODUCT_IMAGE_SOURCES: Record<string, string[]> = {
  "mikrotik-crs326-24s": ["https://mikrotik.com/product/crs326_24s_2q_rm"],
  "mikrotik-ccr2216": ["https://mikrotik.com/product/ccr2216_1g_12xs_2xq"],
  "mikrotik-crs518": ["https://mikrotik.com/product/crs518_16xs_2xq"],
  "mikrotik-rb5009": ["https://mikrotik.com/product/rb5009ug_s_in"],
  "mikrotik-hex-s": ["https://mikrotik.com/product/hex_s"],
  "mikrotik-ccr2004": ["https://mikrotik.com/product/ccr2004_1g_12s_2xs"],
  "mikrotik-hap-ax3": ["https://mikrotik.com/product/hap_ax3"],
  "ubiquiti-udm-pro": ["https://store.ui.com/us/en/products/udm-pro"],
  "ubiquiti-usw-pro-48": ["https://store.ui.com/us/en/products/usw-pro-48"],
  "ubiquiti-unifi-udr": ["https://store.ui.com/us/en/products/udr"],
  "nvidia-dgx-spark": ["https://www.nvidia.com/en-us/project-digits/"],
  "nvidia-rtx-5090": [
    "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/",
  ],
  "nvidia-rtx-4090": [
    "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/",
  ],
  "valve-steam-deck-oled": ["https://www.steamdeck.com/en/oled"],
  "sony-ps5-pro": ["https://www.playstation.com/en-us/ps5/ps5-pro/"],
};
