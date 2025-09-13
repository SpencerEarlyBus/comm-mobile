// features/drawer/styles.ts
import { StyleSheet } from 'react-native';

type MakeDrawerStylesOpts = {
  headerHeight: number;   // pass insets.top + 56
  drawerWidth: number;
  bgColor: string;
  borderColor: string;
};

export const makeDrawerStyles = ({ headerHeight, drawerWidth, bgColor, borderColor }: MakeDrawerStylesOpts) =>
  StyleSheet.create({
    drawer: {
      position: 'absolute',
      top: headerHeight,           // <-- below header (incl. safe-area)
      bottom: 0,
      left: 0,
      width: drawerWidth,
      backgroundColor: bgColor,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: borderColor,
      paddingTop: 12,
      paddingHorizontal: 12,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 2, height: 0 },
      elevation: 6,
      zIndex: 20,                  // <-- above content
    },
    overlay: {
      position: 'absolute',
      top: headerHeight,           // <-- below header
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000',
      zIndex: 10,                  // <-- above content, below drawer
    },
  });
