import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { BRAND } from "../theme";

type CatalogueThumbnailProps = {
  uri: string | null;
  size: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function CatalogueThumbnail({
  uri,
  size,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: CatalogueThumbnailProps): React.ReactElement | null {
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  if (!uri) {
    return null;
  }

  const baseStyle = [
    styles.thumbnail,
    {
      width: size,
      height: size,
      borderRadius: Math.round(size / 3),
    },
  ];

  if (loadFailed) {
    return <View style={baseStyle} />;
  }

  const image = (
    <Image
      source={{ uri, cache: "force-cache" }}
      style={baseStyle}
      resizeMode="cover"
      accessibilityRole={onPress ? undefined : "image"}
      accessibilityLabel={onPress ? undefined : accessibilityLabel}
      onError={() => {
        setLoadFailed(true);
      }}
    />
  );

  if (!onPress) {
    return image;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
    >
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.blueSoft,
  },
});
