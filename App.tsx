// App.tsx
import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/MobileAuthContext';
import { MenuProvider } from './src/context/MenuContext';
import MenuPortal from './src/components/MenuPortal';
import FooterNav from './src/components/FooterNav';
import { navigationRef } from './src/navigation/navRef';   // ← add
import { UIChromeProvider } from './src/context/UIChromeContext';

import HomeScreen from './src/screens/HomeScreen';
import AuthedSessionsScreen from './src/screens/AuthedSessionsScreen';
import AuthedRecorderScreen from './src/screens/AuthedRecorderScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import TopicsTodayScreen from './src/screens/TopicsTodayScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CaptureScreen from './src/screens/CaptureScreen';


import type { RootStackParamList } from './src/navigation/navRef';     

const Stack = createNativeStackNavigator<RootStackParamList>();        

const qc = new QueryClient();

export default function App() {
  const [routeName, setRouteName] = useState<string | undefined>();

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <UIChromeProvider>
      <AuthProvider>
        <MenuProvider>
          <QueryClientProvider client={qc}>
            <NavigationContainer
              ref={navigationRef}
              onReady={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
              onStateChange={() => setRouteName(navigationRef.getCurrentRoute()?.name)}
            >
              <MenuPortal />
              <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Sessions" component={AuthedSessionsScreen} />
                <Stack.Screen name="Recorder" component={AuthedRecorderScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />    
                <Stack.Screen name="TopicsToday" component={TopicsTodayScreen} />     
                <Stack.Screen
                    name="Capture"
                    component={CaptureScreen}
                    options={{
                      headerShown: false,
                      presentation: 'card',
                      animation: 'slide_from_right',
                      contentStyle: { backgroundColor: 'black' },
                    }}
                  />
              </Stack.Navigator>

              {/* Persistent footer (no hooks) */}
              <FooterNav currentRoute={routeName} />
            </NavigationContainer>
          </QueryClientProvider>
        </MenuProvider>
      </AuthProvider>
      </UIChromeProvider>
    </SafeAreaProvider>
  );
}
