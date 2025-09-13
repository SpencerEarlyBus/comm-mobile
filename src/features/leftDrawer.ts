// features/drawer/useLeftDrawer.ts
import { useCallback, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

type Opts = {
  headerHeight: number;   // e.g. 56
  drawerWidth: number;    // e.g. 280
  onOpenChange?: (open: boolean) => void;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function useLeftDrawer({ headerHeight, drawerWidth, onOpenChange }: Opts) {
  const drawerX = useSharedValue(-drawerWidth);
  const dragStartX = useSharedValue(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    onOpenChange?.(true);
    drawerX.value = withTiming(0, { duration: 220 });
  }, [drawerX, onOpenChange]);

  const closeDrawer = useCallback(() => {
    drawerX.value = withTiming(-drawerWidth, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setDrawerOpen)(false);
        onOpenChange?.(false);
      }
    });
  }, [drawerX, drawerWidth, onOpenChange]);

  // Edge swipe (below header only)
  const edgeSwipe = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart((e) => {
      const fromLeftEdge = e.absoluteX < 20;
      const belowHeader = e.absoluteY > headerHeight;
      if (!drawerOpen && !(fromLeftEdge && belowHeader)) return;
      dragStartX.value = drawerX.value;
    })
    .onUpdate((e) => {
      const nextX = clamp(dragStartX.value + e.translationX, -drawerWidth, 0);
      drawerX.value = nextX;
    })
    .onEnd((_e) => {
      const shouldOpen = drawerX.value > -drawerWidth * 0.6;
      if (shouldOpen) runOnJS(openDrawer)();
      else runOnJS(closeDrawer)();
    });

  // Drag on the drawer itself
  const drawerDrag = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart((_e) => {
      dragStartX.value = drawerX.value;
    })
    .onUpdate((e) => {
      const nextX = clamp(dragStartX.value + e.translationX, -drawerWidth, 0);
      drawerX.value = nextX;
    })
    .onEnd((_e) => {
      const shouldOpen = drawerX.value > -drawerWidth * 0.6;
      if (shouldOpen) runOnJS(openDrawer)();
      else runOnJS(closeDrawer)();
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => {
    const openAmt = 1 - Math.max(0, Math.min(1, Math.abs(drawerX.value) / drawerWidth));
    return { opacity: withTiming(openAmt * 0.5, { duration: 120 }) };
  });

  return { drawerOpen, openDrawer, closeDrawer, edgeSwipe, drawerDrag, drawerStyle, overlayStyle };
}
