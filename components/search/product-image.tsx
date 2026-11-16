import { useEffect, useState, useCallback } from "react";
import { View, Text, Animated } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchProductImage } from "@/lib/server-images";

const imageCache = new Map<string, string | null>();
const IMAGE_CACHE_MAX = 200;

function setImageCache(key: string, value: string | null) {
  if (imageCache.has(key)) imageCache.delete(key);
  else if (imageCache.size >= IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value as string | undefined;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  imageCache.set(key, value);
}

const PLACEHOLDER_SIZE = 48;

// ─── Concurrency-limited loader (max 3 in-flight) with idle deferral ───
const MAX_CONCURRENT_IMAGE_FETCHES = 3;
let activeImageFetches = 0;
type QueuedTask = () => void;
const imageQueue: QueuedTask[] = [];

function scheduleIdle(cb: () => void) {
  const g = globalThis as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (typeof g.requestIdleCallback === "function") {
    g.requestIdleCallback(cb, { timeout: 800 });
  } else {
    setTimeout(cb, 32);
  }
}

function drainImageQueue() {
  while (activeImageFetches < MAX_CONCURRENT_IMAGE_FETCHES && imageQueue.length > 0) {
    const task = imageQueue.shift()!;
    activeImageFetches += 1;
    scheduleIdle(task);
  }
}

function enqueueImageFetch(task: QueuedTask) {
  imageQueue.push(task);
  drainImageQueue();
}

function dequeueImageFetchOnComplete() {
  activeImageFetches = Math.max(0, activeImageFetches - 1);
  drainImageQueue();
}

function ImagePlaceholder({
  colors,
  marginRight = 12,
}: {
  colors: ReturnType<typeof useColors>;
  marginRight?: number;
}) {
  return (
    <View
      style={{
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
        borderRadius: 8,
        marginRight,
        backgroundColor: colors.primary + "12",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.primary + "22",
      }}
      accessibilityLabel="Product image unavailable"
    >
      <IconSymbol name="photo" size={20} color={colors.primary} />
    </View>
  );
}

export function ProductImage({
  productId,
  sourceUrls,
  size = 48,
  marginRight = 12,
}: {
  productId: string;
  /** Distributor product pages to try for a real photo, in order. */
  sourceUrls?: string[];
  size?: number;
  marginRight?: number;
}) {
  const colors = useColors();
  const sourceKey = sourceUrls?.join("|") ?? "";
  const thumbWidth = size <= 64 ? 96 : undefined;
  const cacheKey = `${productId}|${sourceKey}|w${thumbWidth ?? 0}`;
  const [image, setImage] = useState<{ key: string; url: string | null } | null>(
    null,
  );
  const imageUrl =
    image?.key === cacheKey
      ? image.url
      : (imageCache.get(cacheKey) ?? null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = loadedFor === cacheKey;
  const [errorFor, setErrorFor] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();
  const imageError = errorFor === cacheKey;
  const opacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    let active = true;
    let queued = false;
    let taskRef: QueuedTask | null = null;
    opacity.setValue(0);
    if (imageCache.has(cacheKey)) {
      return () => {
        active = false;
      };
    }
    const run = () => {
      queued = false;
      if (!active) {
        dequeueImageFetchOnComplete();
        return;
      }
      fetchProductImage(productId, {
        sourceUrls: sourceKey ? sourceKey.split("|") : undefined,
        thumbWidth,
      })
        .then((res) => {
          const url = res?.thumbnailUrl ?? res?.imageUrl ?? null;
          setImageCache(cacheKey, url);
          if (active) setImage({ key: cacheKey, url });
        })
        .catch(() => {
          if (active) setImageCache(cacheKey, null);
        })
        .finally(() => {
          dequeueImageFetchOnComplete();
        });
    };
    taskRef = run;
    if (activeImageFetches < MAX_CONCURRENT_IMAGE_FETCHES) {
      activeImageFetches += 1;
      scheduleIdle(run);
      queued = true;
    } else {
      enqueueImageFetch(run);
      queued = true;
    }
    return () => {
      active = false;
      if (queued && taskRef) {
        const idx = imageQueue.indexOf(taskRef);
        if (idx !== -1) imageQueue.splice(idx, 1);
      }
    };
  }, [cacheKey, productId, sourceKey, thumbWidth, opacity]);

  const handleLoad = useCallback(() => {
    setLoadedFor(cacheKey);
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity, cacheKey, reduceMotion]);

  const handleError = useCallback(() => {
    setImageCache(cacheKey, null);
    setErrorFor(cacheKey);
  }, [cacheKey]);

  if (!imageUrl || imageError) {
    if (size !== PLACEHOLDER_SIZE) {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            marginRight,
            backgroundColor: colors.primary + "12",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.primary + "22",
          }}
          accessibilityLabel="Product image unavailable"
        >
          <IconSymbol name="photo" size={Math.max(14, size * 0.42)} color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 7, marginTop: 1 }} numberOfLines={1} ellipsizeMode="tail">
            No image
          </Text>
        </View>
      );
    }
    return <ImagePlaceholder colors={colors} marginRight={marginRight} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        marginRight,
        backgroundColor: colors.border + "66",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {!loaded && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.border + "66",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol name="photo" size={Math.max(14, size * 0.42)} color={colors.muted + "66"} />
        </View>
      )}
      <Animated.Image
        source={{ uri: imageUrl }}
        onLoad={handleLoad}
        onError={handleError}
        style={{ width: size, height: size, borderRadius: 8, opacity }}
        resizeMode="cover"
        accessibilityLabel="Product image"
      />
    </View>
  );
}
