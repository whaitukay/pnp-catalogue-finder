import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PaginationControls } from "../components/PaginationControls";
import { useImports, usePaginatedScroll } from "../hooks";
import { BRAND, sharedStyles } from "../theme";
import { formatTimestamp, paginate } from "../utils/catalogueUi";

const IMPORTS_PAGE_SIZE = 8;

export function ImportsScreen(): React.ReactElement {
  const { importsList, importFile, openImport, removeImport } = useImports();
  const [importsPage, setImportsPage] = React.useState(0);
  const { scrollRef, handlePageChange } = usePaginatedScroll(setImportsPage);

  React.useEffect(() => {
    setImportsPage(0);
  }, [importsList.length]);

  const pagedImportsList = React.useMemo(() => {
    return paginate(importsList, importsPage, IMPORTS_PAGE_SIZE);
  }, [importsList, importsPage]);

  return (
    <ScrollView contentContainerStyle={sharedStyles.content} ref={scrollRef}>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>Imported collections</Text>
        <Text style={sharedStyles.bodyText}>
          Import ad-hoc CSV/XLSX files containing base product codes and optional barcodes.
        </Text>
        <View style={sharedStyles.buttonRow}>
          <Pressable
            onPress={() => {
              void importFile();
            }}
            style={sharedStyles.primaryButton}
          >
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
                onPress={() => {
                  void openImport(item.id);
                }}
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
                        onPress: () => {
                          void removeImport(item.id);
                        },
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
        onPageChange={handlePageChange}
        page={importsPage}
        pageSize={IMPORTS_PAGE_SIZE}
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
