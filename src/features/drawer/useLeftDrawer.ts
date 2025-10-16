// features/drawer/useLeftDrawer.ts
import { useCallback, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

type Opts = {
  headerHeight: number;
  drawerWidth: number;
  onOpenChange?: (open: boolean) => void;
};

export function useLeftDrawer({ headerHeight, drawerWidth, onOpenChange }: Opts) {
  const drawerX = useSharedValue(-drawerWidth);
  const dragStartX = useSharedValue(0);

  // 🔒 use a shared value to reflect "open" on the UI thread
  const isOpenSV = useSharedValue(false);

  // still keep React state for your app logic/rendering
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    onOpenChange?.(true);
    isOpenSV.value = true;
    drawerX.value = withTiming(0, { duration: 220 });
  }, [drawerX, isOpenSV, onOpenChange]);

  const closeDrawer = useCallback(() => {
    drawerX.value = withTiming(-drawerWidth, { duration: 200 }, (finished) => {
      'worklet';
      if (finished) {
        isOpenSV.value = false;
        runOnJS(setDrawerOpen)(false);
        if (onOpenChange) runOnJS(onOpenChange)(false);
      }
    });
  }, [drawerX, drawerWidth, isOpenSV, onOpenChange]);

  // ✅ worklet-safe clamp
  const clampW = (v: number, min: number, max: number) => {
    'worklet';
    return Math.min(max, Math.max(min, v));
  };

  // Edge swipe (below header only)
  const edgeSwipe = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      'worklet';
      const fromLeftEdge = e.absoluteX < 20;
      const belowHeader = e.absoluteY > headerHeight;
      // use shared "open" state on the UI thread
      if (!isOpenSV.value && !(fromLeftEdge && belowHeader)) return;
      dragStartX.value = drawerX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const nextX = clampW(dragStartX.value + e.translationX, -drawerWidth, 0);
      drawerX.value = nextX;
    })
    .onEnd(() => {
      'worklet';
      const shouldOpen = drawerX.value > -drawerWidth * 0.6;
      if (shouldOpen) runOnJS(openDrawer)();
      else runOnJS(closeDrawer)();
    });

  // Drag on the drawer itself
  const drawerDrag = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart(() => {
      'worklet';
      dragStartX.value = drawerX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const nextX = clampW(dragStartX.value + e.translationX, -drawerWidth, 0);
      drawerX.value = nextX;
    })
    .onEnd(() => {
      'worklet';
      const shouldOpen = drawerX.value > -drawerWidth * 0.6;
      if (shouldOpen) runOnJS(openDrawer)();
      else runOnJS(closeDrawer)();
    });

  const drawerStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: drawerX.value }] };
  });

  const overlayStyle = useAnimatedStyle(() => {
    'worklet';
    const openAmt =
      1 - Math.max(0, Math.min(1, Math.abs(drawerX.value) / drawerWidth));
    return { opacity: withTiming(openAmt * 0.5, { duration: 120 }) };
  });

  return {
    drawerOpen,
    openDrawer,
    closeDrawer,
    edgeSwipe,
    drawerDrag,
    drawerStyle,
    overlayStyle,
  };
}
