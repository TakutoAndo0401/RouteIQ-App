module.exports = {
  dependencies: {
    "@expo/dom-webview": {
      platforms: {
        ios: null,
        android: null,
      },
    },
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()",
        },
      },
    },
  },
};
