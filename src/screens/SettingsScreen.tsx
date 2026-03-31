import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useFeedback, useSettings } from "../hooks";
import { BRAND, sharedStyles } from "../theme";
import { EXPORT_FIELD_OPTIONS } from "../types";
import type { ExportFieldKey } from "../types";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

export function SettingsScreen(): React.ReactElement {
  const {
    storeCode,
    hideExpiredCatalogues,
    exportFields,
    settingsDirty,
    settingsLoading,
    onStoreCodeChange,
    onHideExpiredChange,
    onToggleExportField,
    saveAppSettings,
  } = useSettings();
  const { clearFeedback, setBusy, setError, setStatus } = useFeedback();

  const handleSaveSettings = React.useCallback(async () => {
    const wasDirty = settingsDirty;
    setBusy("Saving settings...");
    clearFeedback();

    try {
      const outcome = await saveAppSettings();
      if (!wasDirty) {
        setStatus("Settings already up to date.");
      } else if (outcome.fieldsChanged) {
        setStatus(
          `Settings saved. Rebuilt ${outcome.rebuiltCount} CSV export(s).`,
        );
      } else {
        setStatus("Settings saved.");
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }, [clearFeedback, saveAppSettings, setBusy, setError, setStatus, settingsDirty]);

  if (settingsLoading) {
    return (
      <ScrollView contentContainerStyle={sharedStyles.content}>
        <View style={sharedStyles.card}>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={BRAND.blue} />
            <Text style={sharedStyles.bodyText}>Loading settings...</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={sharedStyles.content}>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>Store</Text>
        <Text style={sharedStyles.bodyText}>
          Used for live catalogue discovery, single-URL scans, and barcode resolution.
        </Text>
        <Text style={sharedStyles.label}>Store code</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={onStoreCodeChange}
          style={sharedStyles.input}
          value={storeCode}
        />
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>Display settings</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchTextWrap}>
            <Text style={styles.switchTitle}>Hide expired catalogues</Text>
            <Text style={sharedStyles.bodyText}>
              Applies to the live catalogue list and the cached dump library.
            </Text>
          </View>
          <Switch
            onValueChange={onHideExpiredChange}
            thumbColor={hideExpiredCatalogues ? BRAND.red : "#f2f5fa"}
            trackColor={{ false: "#c7d4e7", true: "#ffc4bf" }}
            value={hideExpiredCatalogues}
          />
        </View>
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>CSV export fields</Text>
        <Text style={sharedStyles.bodyText}>
          Saving field changes rewrites cached CSV exports so email attachments use the new shape.
        </Text>

        <View style={styles.fieldList}>
          {EXPORT_FIELD_OPTIONS.map((field) => {
            const selected = exportFields.includes(field.key);
            return (
              <Pressable
                key={field.key}
                onPress={() => onToggleExportField(field.key)}
                style={[styles.fieldCard, selected && styles.fieldCardActive]}
              >
                <Text style={[styles.fieldTitle, selected && styles.fieldTitleActive]}>
                  {field.label}
                </Text>
                <Text
                  style={[
                    styles.fieldDescription,
                    selected && styles.fieldDescriptionActive,
                  ]}
                >
                  {field.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={handleSaveSettings} style={sharedStyles.primaryButton}>
        <Text style={sharedStyles.primaryButtonText}>
          {settingsDirty ? "Save settings" : "Rebuild CSVs"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  switchTextWrap: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BRAND.ink,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fieldList: {
    gap: 10,
    marginTop: 10,
  },
  fieldCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.white,
    padding: 14,
    gap: 4,
  },
  fieldCardActive: {
    backgroundColor: BRAND.blueSoft,
    borderColor: "#8cb4e6",
  },
  fieldTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: BRAND.ink,
  },
  fieldTitleActive: {
    color: BRAND.blueDark,
  },
  fieldDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: BRAND.slate,
  },
  fieldDescriptionActive: {
    color: BRAND.blue,
  },
});
