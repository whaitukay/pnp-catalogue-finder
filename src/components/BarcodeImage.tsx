import * as bwipjs from "@bwip-js/react-native";
import React from "react";
import { Image, PixelRatio } from "react-native";

import { ean13ToRawSbs, isScaleItemEan13 } from "../utils/barcodes";

export type BarcodeImageProps = {
  format: "EAN13" | "EAN8";
  value: string;
  onError?: () => void;
};

export function BarcodeImage({
  format,
  value,
  onError,
}: BarcodeImageProps): React.ReactElement | null {
  const [source, setSource] = React.useState<bwipjs.DataURL | null>(null);
  const handleError = React.useCallback(() => {
    onError?.();
  }, [onError]);

  React.useEffect(() => {
    const scale = Math.max(1, Math.round(PixelRatio.get()));
    const isScaleCode = format === "EAN13" && isScaleItemEan13(value);
    const rawSbs = isScaleCode ? ean13ToRawSbs(value) : null;
    const bcid = format === "EAN8" ? "ean8" : isScaleCode ? "raw" : "ean13";
    if (isScaleCode && !rawSbs) {
      setSource(null);
      handleError();
      return;
    }

    const options: Parameters<typeof bwipjs.toDataURL>[0] = {
      bcid,
      text: isScaleCode ? rawSbs! : value,
      scale,
      height: 12,
      includetext: true,
      ...(isScaleCode ? { alttext: value } : {}),
    };

    const cacheKey = `${bcid}:${options.text}:${scale}`;
    const cachedSource = getBarcodeImageFromCache(cacheKey);
    if (cachedSource) {
      setSource(cachedSource);
      return;
    }

    let cancelled = false;
    setSource(null);

    bwipjs
      .toDataURL(options)
      .then((nextSource: bwipjs.DataURL) => {
        putBarcodeImageInCache(cacheKey, nextSource);

        if (!cancelled) {
          setSource(nextSource);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.warn(`Failed to generate barcode image (${format})`, {
            valueLength: value.length,
            error,
          });
          handleError();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [format, value, handleError]);

  if (!source) {
    return null;
  }

  return (
    <Image
      resizeMode="contain"
      source={{ uri: source.uri }}
      style={{
        width: "100%",
        height: 72,
      }}
    />
  );
}

// Keep this small: `bwipjs.toDataURL()` returns a base64 `data:` URI, which can be memory-heavy.
const BARCODE_IMAGE_CACHE_LIMIT = 100;
const barcodeImageCache = new Map<string, bwipjs.DataURL>();

function getBarcodeImageFromCache(key: string): bwipjs.DataURL | null {
  const cached = barcodeImageCache.get(key);
  if (!cached) {
    return null;
  }

  barcodeImageCache.delete(key);
  barcodeImageCache.set(key, cached);
  return cached;
}

function putBarcodeImageInCache(key: string, value: bwipjs.DataURL): void {
  barcodeImageCache.set(key, value);
  if (barcodeImageCache.size > BARCODE_IMAGE_CACHE_LIMIT) {
    const keyToEvict = barcodeImageCache.keys().next().value;
    if (typeof keyToEvict === "string") {
      barcodeImageCache.delete(keyToEvict);
    }
  }
}
