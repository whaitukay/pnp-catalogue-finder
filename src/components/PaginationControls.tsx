import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BRAND } from "../theme";
import { totalPages } from "../utils/catalogueUi";

type PaginationControlsProps = {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
};

export function PaginationControls({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationControlsProps): React.ReactElement | null {
  const pages = totalPages(totalItems, pageSize);
  if (pages <= 1) {
    return null;
  }

  const atStart = page === 0;
  const atEnd = page >= pages - 1;

  return (
    <View style={styles.row}>
      <Pressable
        disabled={atStart}
        onPress={() => onPageChange(Math.max(0, page - 1))}
        style={[styles.button, atStart && styles.disabled]}
      >
        <Text style={styles.buttonText}>Previous</Text>
      </Pressable>
      <Text style={styles.text}>
        Page {page + 1} of {pages}
      </Text>
      <Pressable
        disabled={atEnd}
        onPress={() => onPageChange(Math.min(pages - 1, page + 1))}
        style={[styles.button, atEnd && styles.disabled]}
      >
        <Text style={styles.buttonText}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: BRAND.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 12,
  },
  button: {
    backgroundColor: BRAND.blueSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: BRAND.blue,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    flex: 1,
    textAlign: "center",
    color: BRAND.slate,
    fontWeight: "700",
  },
});
