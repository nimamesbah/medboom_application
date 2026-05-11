import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
// Added ImageBackground and Image below
import { BackHandler, Image, ImageBackground, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";

const DEFAULT_URL = "https://medboom.ir";
const STORAGE_KEY = "@saved_url";

export default function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  // 1. Added custom splash state
  const [showSplash, setShowSplash] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // 2. Added splash screen timer (3 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Load the saved URL on startup
  useEffect(() => {
    const loadUrl = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(STORAGE_KEY);
        setCurrentUrl(savedUrl !== null ? savedUrl : DEFAULT_URL);
      } catch (e) {
        setCurrentUrl(DEFAULT_URL);
      }
    };
    loadUrl();
  }, []);

  // Set Android Navigation Bar to Dark Mode
  useEffect(() => {
    async function setNavBar() {
      await NavigationBar.setButtonStyleAsync("dark");
    }
    setNavBar();
  }, []);

  // Handle Android Hardware Back Button
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    return () => backSubscription.remove();
  }, [canGoBack]);

  // Robust Injected JavaScript
  const injectedJS = `
  // --- Forward console.log to React Native ---
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONSOLE', data: args.join(' ') }));
  };

  // --- Zoom Blocking ---
  const meta = document.createElement('meta');
  meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
  meta.setAttribute('name', 'viewport');
  document.getElementsByTagName('head')[0].appendChild(meta);

  // --- Touch Gesture Logic ---
  let touchTimer;
  
  document.addEventListener('touchstart', (e) => {
    console.log('Touch started! Fingers on screen: ' + e.touches.length);
    
    if (e.touches.length === 2) {
      console.log('2 fingers detected! Starting 4-second timer...');
      touchTimer = setTimeout(() => {
        console.log('4 seconds passed! Sending URL to React Native...');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SAVE_URL',
          url: window.location.href
        }));
      }, 4000);
    }
  }, true); 

  document.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      if (touchTimer) {
        console.log('Touch ended or finger removed. Canceling timer.');
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    }
  }, true);
  
  true;
`;

  const saveUrl = async (newUrl: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newUrl);
      Toast.show({
        type: "success",
        text1: "این صفحه به عنوان صفحه پیشفرض اپلیکیشن انتخاب شد",
        position: "top",
        visibilityTime: 4000,
      });
    } catch (e) {
      console.error("Failed to save URL", e);
    }
  };

  // 3. Custom Splash Screen Render Logic
  // Show splash if timer is running OR if currentUrl hasn't loaded from storage yet
  if (showSplash || !currentUrl) {
    return (
      <ImageBackground
        source={require("../assets/images/splashBg.jpg")} // <-- UPDATE THIS ROUTE
        style={styles.splashContainer}
      >
        <Image
          source={require("../assets/images/mainPng.png")} // <-- UPDATE THIS ROUTE
          style={styles.logo}
        />
        <StatusBar style="light" backgroundColor="#000000" />
      </ImageBackground>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webview}
          injectedJavaScript={injectedJS}
          onMessage={(event) => {
            try {
              const parsedData = JSON.parse(event.nativeEvent.data);

              if (parsedData.type === "CONSOLE") {
                console.log("[WebView Log]:", parsedData.data);
              } else if (parsedData.type === "SAVE_URL") {
                saveUrl(parsedData.url);
              }
            } catch (e) {
              console.log("Message from WebView:", event.nativeEvent.data);
            }
          }}
          onNavigationStateChange={(navState) =>
            setCanGoBack(navState.canGoBack)
          }
          bounces={false}
          scalesPageToFit={false}
        />
        <StatusBar style="light" backgroundColor="#000000" />
      </SafeAreaView>
      <Toast />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  webview: {
    flex: 1,
  },
  // 4. Added splash styles
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
});
