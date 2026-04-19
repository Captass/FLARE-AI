const config = {
  appId: "com.ramsflare.flareai",
  appName: "FLARE AI",
  webDir: "out",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
    allowNavigation: ["flare-backend-ab5h.onrender.com"],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    Browser: {
      presentationStyle: "fullscreen",
    },
  },
};

export default config;
