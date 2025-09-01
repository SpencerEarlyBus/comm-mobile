// components/Card.tsx
import { View } from 'react-native';
export default function Card({ style, ...p }: any) {
  return (
    <View
      {...p}
      style={[
        {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.25)',
          backgroundColor: '#0f172a',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
    />
  );
}
