// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/context/MobileAuthContext';
import { MenuProvider } from './src/context/MenuContext';
import MenuPortal from './src/components/MenuPortal';
import { HeaderHamburger, HeaderUser } from './src/components/HeaderButtons';

import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import AuthedSessionsScreen from './src/screens/AuthedSessionsScreen';
import AuthedRecorderScreen from './src/screens/AuthedRecorderScreen';

const Stack = createNativeStackNavigator();
const qc = new QueryClient();

export default function App() {
  return (
    <AuthProvider>
      <MenuProvider>
        <QueryClientProvider client={qc}>
          <NavigationContainer>
            <MenuPortal /> {/* global modal(s) */}
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{
                headerLeft: () => <HeaderHamburger />,
                headerRight: () => <HeaderUser />,
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Comm Mobile', headerBackVisible: false }} />
              <Stack.Screen name="Sessions" component={AuthedSessionsScreen} options={{ title: 'Sessions' }} />
              <Stack.Screen name="Recorder" component={AuthedRecorderScreen} options={{ title: 'Recorder' }} />
            </Stack.Navigator>
          </NavigationContainer>
        </QueryClientProvider>
      </MenuProvider>
    </AuthProvider>
  );
}
