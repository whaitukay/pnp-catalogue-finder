import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PaginationControls } from "../components/PaginationControls";
import { BRAND, sharedStyles } from "../theme";
import type { ImportedCatalogueSummary } from "../types";
import { formatTimestamp } from "../utils/catalogueUi";

type ImportsScreenProps = {
  importsList: ImportedCatalogueSummary[];
  pagedImportsList: ImportedCatalogueSummary[];
  importsPage: number;
  onImport: () => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onImportsPageChange: (nextPage: number) => void;
};

export function ImportsScreen({
  importsList,
  pagedImportsList,
  importsPage,
  onImport,
  onDelete,
  onOpen,
  onImportsPageChange,
}: ImportsScreenProps): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={sharedStyles.content}>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>Imported collections</Text>
        <Text style={sharedStyles.bodyText}>
          Import ad-hoc CSV/XLSX files containing base product codes and optional barcodes.
        </Text>
        <View style={sharedStyles.buttonRow}>
          <Pressable onPress={onImport} style={sharedStyles.primaryButton}>
            <Text style={sharedStyles.primaryButtonText}>Import file</Text>
          </Pressable>
        </View>
        <Text style={sharedStyles.metaText}>
          Showing {importsList.length} import(s).
        </Text>
      </View>

      {pagedImportsList.length > 0 ? (
        pagedImportsList.map((item) => (
          <View key={item.id} style={sharedStyles.card}>
            <Text style={sharedStyles.cardTitle}>{item.name}</Text>
            <View style={styles.summaryRow}>
              <Text style={sharedStyles.metaText}>Imported</Text>
              <Text style={[sharedStyles.metaText, styles.summaryValue]}>
                {formatTimestamp(item.importedAt)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={sharedStyles.metaText}>Items</Text>
              <Text style={[sharedStyles.metaText, styles.summaryValue]}>{item.itemCount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={sharedStyles.metaText}>Barcodes</Text>
              <Text style={[sharedStyles.metaText, styles.summaryValue]}>
                {item.barcodeCount}/{item.itemCount}
              </Text>
            </View>
            <View style={sharedStyles.buttonRow}>
              <Pressable
                onPress={() => onOpen(item.id)}
                style={sharedStyles.secondaryButton}
              >
                <Text style={sharedStyles.secondaryButtonText}>View</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Delete import",
                    `Delete ${item.name}? This cannot be undone.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => onDelete(item.id),
                      },
                    ],
                  );
                }}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.bodyText}>No imports yet. Import a file to begin.</Text>
        </View>
      )}

      <PaginationControls
        onPageChange={onImportsPageChange}
        page={importsPage}
        pageSize={8}
        totalItems={importsList.length}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryValue: {
    fontWeight: "800",
  },
  deleteButton: {
    backgroundColor: BRAND.danger,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deleteButtonText: {
    color: BRAND.redDark,
    fontWeight: "800",
  },
});
