import React from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type TouchPoint = {
  pageX?: number;
  pageY?: number;
  locationX?: number;
  locationY?: number;
};

function touchDistance(a: TouchPoint, b: TouchPoint): number | null {
  if (
    typeof a.pageX === "number" &&
    typeof a.pageY === "number" &&
    typeof b.pageX === "number" &&
    typeof b.pageY === "number"
  ) {
    const dx = a.pageX - b.pageX;
    const dy = a.pageY - b.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  if (
    typeof a.locationX === "number" &&
    typeof a.locationY === "number" &&
    typeof b.locationX === "number" &&
    typeof b.locationY === "number"
  ) {
    const dx = a.locationX - b.locationX;
    const dy = a.locationY - b.locationY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  return null;
}

type ZoomableImageProps = {
  source: ImageSourcePropType;
  visible: boolean;
  onClose: () => void;
  minScale?: number;
  maxScale?: number;
  accessibilityLabel?: string;
};

export function ZoomableImage({
  source,
  visible,
  onClose,
  minScale = 1,
  maxScale = 4,
  accessibilityLabel,
}: ZoomableImageProps): React.ReactElement | null {
  const { width, height } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();

  const scale = React.useRef(new Animated.Value(1)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;

  const currentScale = React.useRef(1);
  const currentTranslate = React.useRef({ x: 0, y: 0 });

  const pinchStartDistance = React.useRef<number | null>(null);
  const pinchStartScale = React.useRef(1);
  const gestureWasPinch = React.useRef(false);
  const didPanAfterPinch = React.useRef(false);

  const resetTransforms = React.useCallback(() => {
    currentScale.current = 1;
    currentTranslate.current = { x: 0, y: 0 };
    pinchStartDistance.current = null;
    pinchStartScale.current = 1;
    gestureWasPinch.current = false;
    didPanAfterPinch.current = false;
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
  }, [scale, translateX, translateY]);

  React.useEffect(() => {
    if (visible) {
      resetTransforms();
    }
  }, [resetTransforms, visible]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          pinchStartDistance.current = null;
          pinchStartScale.current = currentScale.current;
          gestureWasPinch.current = false;
          didPanAfterPinch.current = false;
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches =
            evt.nativeEvent.touches.length >= 2
              ? evt.nativeEvent.touches
              : evt.nativeEvent.changedTouches;

          if (touches.length >= 2) {
            gestureWasPinch.current = true;
            const nextDistance = touchDistance(touches[0], touches[1]);
            if (nextDistance == null || nextDistance <= 0) {
              return;
            }
            if (pinchStartDistance.current == null) {
              pinchStartDistance.current = nextDistance;
              pinchStartScale.current = currentScale.current;
              return;
            }

            const nextScale = clamp(
              pinchStartScale.current *
                (nextDistance / pinchStartDistance.current),
              minScale,
              maxScale,
            );

            scale.setValue(nextScale);
            currentScale.current = nextScale;
            return;
          }

          pinchStartDistance.current = null;
          if (currentScale.current <= 1.01) {
            translateX.setValue(0);
            translateY.setValue(0);
            currentTranslate.current = { x: 0, y: 0 };
            return;
          }

          if (gestureWasPinch.current) {
            didPanAfterPinch.current = true;
          }

          const maxOffsetX = (width * (currentScale.current - 1)) / 2;
          const maxOffsetY = (height * (currentScale.current - 1)) / 2;

          const nextX = clamp(
            currentTranslate.current.x + gestureState.dx,
            -maxOffsetX,
            maxOffsetX,
          );
          const nextY = clamp(
            currentTranslate.current.y + gestureState.dy,
            -maxOffsetY,
            maxOffsetY,
          );

          translateX.setValue(nextX);
          translateY.setValue(nextY);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureWasPinch.current && !didPanAfterPinch.current) {
            gestureWasPinch.current = false;
            pinchStartDistance.current = null;
            didPanAfterPinch.current = false;
            return;
          }

          gestureWasPinch.current = false;
          didPanAfterPinch.current = false;
          pinchStartDistance.current = null;

          if (currentScale.current <= 1.01) {
            resetTransforms();
            return;
          }

          const maxOffsetX = (width * (currentScale.current - 1)) / 2;
          const maxOffsetY = (height * (currentScale.current - 1)) / 2;

          currentTranslate.current = {
            x: clamp(
              currentTranslate.current.x + gestureState.dx,
              -maxOffsetX,
              maxOffsetX,
            ),
            y: clamp(
              currentTranslate.current.y + gestureState.dy,
              -maxOffsetY,
              maxOffsetY,
            ),
          };

          translateX.setValue(currentTranslate.current.x);
          translateY.setValue(currentTranslate.current.y);
        },
      }),
    [height, maxScale, minScale, resetTransforms, scale, translateX, translateY, width],
  );

  if (!visible) {
    return null;
  }

  const closeButtonStyle = [
    styles.previewCloseButton,
    {
      top: safeAreaInsets.top + 16,
      right: safeAreaInsets.right + 16,
    },
  ];

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={onClose}
    >
      <View style={styles.previewOverlay}>
        <Pressable
          style={styles.previewBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
        />
        <View style={styles.previewImageContainer}>
          <Animated.View
            {...panResponder.panHandlers}
            style={{
              width,
              height,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          >
            <Image
              source={source}
              style={{ width, height }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={accessibilityLabel}
            />
          </Animated.View>
        </View>
        <Pressable
          onPress={onClose}
          style={closeButtonStyle}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close image preview"
        >
          <Text style={styles.previewCloseButtonText}>X</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  previewCloseButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
});
