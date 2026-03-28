import { StyleSheet } from "react-native";

export const BRAND = {
  amber: "#fff4dc",
  amberDark: "#8b5d00",
  background: "#f4f8fc",
  blue: "#004a98",
  blueDark: "#00356d",
  blueSoft: "#edf4ff",
  border: "#d6e1f0",
  danger: "#ffe5e2",
  green: "#e7f6ec",
  greenDark: "#1d6b39",
  ink: "#142131",
  red: "#ee3124",
  redDark: "#bf1f17",
  slate: "#40536a",
  white: "#ffffff",
};

export const sharedStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 28,
    gap: 14,
  },
  card: {
    backgroundColor: BRAND.white,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: BRAND.ink,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: BRAND.slate,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 19,
    color: BRAND.slate,
  },
  linkText: {
    fontSize: 12,
    color: BRAND.blue,
  },
  label: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "700",
    color: BRAND.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    backgroundColor: BRAND.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: BRAND.ink,
  },
  inputLarge: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: BRAND.red,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: BRAND.white,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: BRAND.blueSoft,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: BRAND.blue,
    fontWeight: "800",
  },
  errorSmall: {
    fontSize: 12,
    lineHeight: 18,
    color: BRAND.redDark,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  highlightText: {
    fontSize: 15,
    fontWeight: "700",
    color: BRAND.blueDark,
  },
});
