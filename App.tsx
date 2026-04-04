import React from "react";
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { StatusBanner } from "./src/components";
import { AppProviders, useCatalogues, useFeedback, useImports, useSettings } from "./src/hooks";
import { CataloguesScreen } from "./src/screens/CataloguesScreen";
import { DumpsScreen } from "./src/screens/DumpsScreen";
import { ImportViewScreen } from "./src/screens/ImportViewScreen";
import { ImportsScreen } from "./src/screens/ImportsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { BRAND } from "./src/theme";

type TabKey = "catalogues" | "imports" | "settings";

function AppShell({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}): React.ReactElement {
  const { selectedDump, setSelectedDump } = useCatalogues();
  const { selectedImport, setSelectedImport } = useImports();
  const { busyLabel, errorText, statusMessage, clearFeedback, setError } = useFeedback();
  const { settingsLoadError } = useSettings();

  const handleTabChange = React.useCallback(
    (tab: TabKey) => {
      if (tab !== "catalogues") {
        setSelectedDump(null);
      }
      if (tab !== "imports") {
        setSelectedImport(null);
      }
      onTabChange(tab);
    },
    [onTabChange, setSelectedDump, setSelectedImport],
  );

  React.useEffect(() => {
    if (!settingsLoadError) {
      return;
    }

    setError(`Failed to load settings: ${settingsLoadError}`);
  }, [setError, settingsLoadError]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PnP Catalogue Finder</Text>
        <Text style={styles.headerSubtitle}>Bulk scan, cache, and export barcode CSVs.</Text>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => handleTabChange("catalogues")}
          style={[
            styles.tabButton,
            activeTab === "catalogues" && styles.tabButtonActive,
          ]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "catalogues" && styles.tabButtonTextActive,
            ]}
          >
            Catalogues
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange("imports")}
          style={[styles.tabButton, activeTab === "imports" && styles.tabButtonActive]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "imports" && styles.tabButtonTextActive,
            ]}
          >
            Imports
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange("settings")}
          style={[styles.tabButton, activeTab === "settings" && styles.tabButtonActive]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "settings" && styles.tabButtonTextActive,
            ]}
          >
            Settings
          </Text>
        </Pressable>
      </View>

      <StatusBanner
        busyLabel={busyLabel}
        errorText={errorText}
        statusMessage={statusMessage}
        onDismiss={clearFeedback}
      />

      {activeTab === "catalogues" ? (
        selectedDump ? (
          <DumpsScreen
            onBackToCatalogues={() => {
              onTabChange("catalogues");
            }}
          />
        ) : (
          <CataloguesScreen />
        )
      ) : null}
      {activeTab === "imports" ? (
        selectedImport ? (
          <ImportViewScreen />
        ) : (
          <ImportsScreen />
        )
      ) : null}
      {activeTab === "settings" ? <SettingsScreen /> : null}
    </View>
  );
}

export default function App(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<TabKey>("catalogues");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const safeAreaInsetBackground = isDark ? BRAND.backgroundDark : BRAND.background;

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.safeArea, isDark ? styles.safeAreaDark : null]}
      >
        <StatusBar
          backgroundColor={safeAreaInsetBackground}
          barStyle={isDark ? "light-content" : "dark-content"}
        />
        <AppProviders>
          <AppShell activeTab={activeTab} onTabChange={setActiveTab} />
        </AppProviders>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND.background,
  },
  safeAreaDark: {
    backgroundColor: BRAND.backgroundDark,
  },
  container: {
    flex: 1,
    padding: 18,
  },
  header: {
    backgroundColor: BRAND.blue,
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: BRAND.white,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 18,
  },
  tabRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    backgroundColor: BRAND.white,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: BRAND.blue,
    borderColor: BRAND.blue,
  },
  tabButtonText: {
    fontWeight: "800",
    color: BRAND.blue,
  },
  tabButtonTextActive: {
    color: BRAND.white,
  },
});
