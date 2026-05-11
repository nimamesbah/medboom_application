import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";

const DEFAULT_URL = "https://medboom.ir";
const STORAGE_KEY = "@saved_url";
const FIRST_LAUNCH_KEY = "@first_launch_msg_shown"; // Key for tracking first launch

const { height } = Dimensions.get("window");

const toastConfig = {
  myCustomToast: ({ text1 }: { text1?: string }) => (
    <View
      style={{
        width: "90%",
        backgroundColor: "#add8e6",
        paddingVertical: 30, // پدینگ بالا و پایین دو برابر شد (از 15 به 30)
        paddingHorizontal: 15, // پدینگ چپ و راست همان مقدار قبلی ماند
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        elevation: 5,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 4,
        gap: 10,
      }}
    >
      <Ionicons name="checkmark-circle" size={24} color="#008000" />
      <Text style={{ color: "#000", fontSize: 14, fontWeight: "bold" }}>
        {text1}
      </Text>
    </View>
  ),
};

export default function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showInstruction, setShowInstruction] = useState(false); // State for first launch message
  const webViewRef = useRef<WebView>(null);

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Load the saved URL and check for first launch
  useEffect(() => {
    const loadInitData = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(STORAGE_KEY);
        setCurrentUrl(savedUrl !== null ? savedUrl : DEFAULT_URL);

        // Check if instruction message has been shown before
        const hasShownMsg = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
        if (!hasShownMsg) {
          setShowInstruction(true);
        }
      } catch (e) {
        setCurrentUrl(DEFAULT_URL);
      }
    };
    loadInitData();
  }, []);

  // Run opening animation when showInstruction becomes true
  useEffect(() => {
    if (showInstruction) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showInstruction]);

  useEffect(() => {
    async function setNavBar() {
      await NavigationBar.setButtonStyleAsync("light");
    }
    setNavBar();
  }, []);

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

  const injectedJS = `
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONSOLE', data: args.join(' ') }));
  };

  const meta = document.createElement('meta');
  meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
  meta.setAttribute('name', 'viewport');
  document.getElementsByTagName('head')[0].appendChild(meta);

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
        type: "myCustomToast",
        text1: "این صفحه به عنوان صفحه اولیه اپلیکیشن تعیین شد",
        position: "top",
        visibilityTime: 3000,
      });
    } catch (e) {
      console.error("Failed to save URL", e);
    }
  };

  // Close message with animation, then save flag to AsyncStorage
  const closeInstruction = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      setShowInstruction(false);
      try {
        await AsyncStorage.setItem(FIRST_LAUNCH_KEY, "true");
      } catch (e) {
        console.error("Failed to save first launch state", e);
      }
    });
  };

  if (showSplash || !currentUrl) {
    return (
      <ImageBackground
        source={require("../assets/images/splashBg.jpg")}
        style={styles.splashContainer}
      >
        <Image
          source={require("../assets/images/mainPng.png")}
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

        {/* First Launch Instruction Overlay (Animated) */}
        {showInstruction && (
          <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
            <Animated.View
              style={[
                styles.instructionBox,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <TouchableOpacity
                onPress={closeInstruction}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>بستن این پیغام</Text>
                <Ionicons name="close-circle" size={22} color="#0056b3" />
              </TouchableOpacity>

              <Text style={styles.instructionText}>
                با درود،{"\n"}
                شما می‌توانید در صورت تمایل، صفحه اولیه اپلیکیشن مدبوم را خودتان
                تعیین کنید.{"\n\n"}
                روش انجام کار:{"\n"}
                ابتدا صفحه‌ای که می‌خواهید به عنوان صفحه اولیه تعیین شود را باز
                کنید (مثلاً صفحه «استخدام پزشک در تهران»).{"\n"}
                سپس دو انگشت خود را به صورت همزمان روی همان صفحه قرار داده و به
                مدت ۴ ثانیه نگه دارید.{"\n"}
                پس از نمایش پیغام تأیید، صفحه مورد نظر به عنوان صفحه اولیه تعیین
                می‌شود.{"\n"}
                با این کار، از دفعات بعد که اپ را باز می‌کنید، مستقیماً صفحه
                مورد نظر شما بارگذاری می‌شود.
              </Text>
            </Animated.View>
          </Animated.View>
        )}

        <StatusBar style="light" backgroundColor="#000000" />
      </SafeAreaView>
      <Toast config={toastConfig} position="top" topOffset={height / 2 - 30} />
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
  // Added styles for the instruction overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)", // Semi-transparent dark background
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 10, // Ensure it sits above WebView
  },
  instructionBox: {
    backgroundColor: "#e6f3ff", // Light blue background
    padding: 20,
    borderRadius: 15,
    width: "100%",
    maxWidth: 400,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: "#b3d9ff",
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end", // Align items inside to the right
    alignSelf: "flex-end", // Align the button itself to the right
    backgroundColor: "#cce6ff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 15,
    gap: 5, // Gap between text and icon
  },
  closeBtnText: {
    color: "#0056b3",
    fontWeight: "bold",
    fontSize: 14,
  },
  instructionText: {
    color: "#003366", // Darker blue for readable text
    fontSize: 15,
    lineHeight: 28,
    textAlign: "right", // Right-aligned for Persian text
    fontFamily: "System",
  },
});
