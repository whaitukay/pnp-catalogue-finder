import React from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { sharedStyles } from "../theme";

type ScanScreenProps = {
  scanUrl: string;
  onScanUrlChange: (value: string) => void;
  onScan: () => void;
};

export function ScanScreen({
  scanUrl,
  onScanUrlChange,
  onScan,
}: ScanScreenProps): React.ReactElement {
  return (
    <ScrollView contentContainerStyle={sharedStyles.content}>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>Scan a single Shop now URL</Text>
        <Text style={sharedStyles.bodyText}>
          Paste a Pick n Pay Shop now or Buy now URL. The app will pull the product list, resolve real barcodes, capture promotion dates, and cache the dump locally.
        </Text>
      </View>

      <Text style={sharedStyles.label}>Shop now URL or catalogue slug</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={onScanUrlChange}
        style={[sharedStyles.input, sharedStyles.inputLarge]}
        value={scanUrl}
      />

      <Pressable onPress={onScan} style={sharedStyles.primaryButton}>
        <Text style={sharedStyles.primaryButtonText}>Scan this catalogue</Text>
      </Pressable>
    </ScrollView>
  );
}
