import { colors } from "./colors";

export { colors };

export interface ColorTheme {
  background: string;
  surface: string;
  surfaceSubtle: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryHover: string;
  primaryPressed: string;
  expressway: string;
  expresswayBg: string;
  local: string;
  localBg: string;
  highlight: string;
  highlightBg: string;
  danger: string;
  dangerBg: string;
  cardShadow: string;
}

export const lightTheme: ColorTheme = {
  background: colors.neutral[50], // #F4F6F4
  surface: colors.white, // #FFFFFF
  surfaceSubtle: colors.neutral[100], // #E8EFE9
  border: colors.neutral[200], // #DCE3DD
  textPrimary: colors.neutral[900], // #1C2420
  textSecondary: colors.neutral[700], // #56625D
  textMuted: colors.neutral[500], // #8A9790
  primary: colors.primary[500], // #4E6A56
  primaryLight: colors.primary[100], // #E1EBE3
  primaryHover: colors.primary[600], // #3F5645
  primaryPressed: colors.primary[700], // #314335
  expressway: colors.primary[500], // #4E6A56
  expresswayBg: colors.primary[50], // #F0F5F1
  local: colors.success[500], // #2D9B52
  localBg: colors.success[50], // #ECFAF0
  highlight: colors.warning[600], // #D97706
  highlightBg: colors.warning[50], // #FFFBEB
  danger: colors.error[400], // #E07A5F
  dangerBg: colors.error[50], // #FDF0EB
  cardShadow: "rgba(78, 106, 86, 0.08)",
};

export const darkTheme: ColorTheme = {
  background: colors.primary[900], // #151E18
  surface: colors.neutral[900], // #1C2420
  surfaceSubtle: colors.neutral[800], // #3A4440
  border: colors.neutral[700], // #56625D
  textPrimary: colors.neutral[50], // #F4F6F4
  textSecondary: colors.neutral[300], // #C5CFC8
  textMuted: colors.neutral[400], // #A3B0A7
  primary: colors.primary[400], // #6E9478
  primaryLight: colors.primary[800], // #233026
  primaryHover: colors.primary[500], // #4E6A56
  primaryPressed: colors.primary[600], // #3F5645
  expressway: colors.primary[300], // #9BBDA4
  expresswayBg: colors.primary[900], // #151E18
  local: colors.success[400], // #45B86B
  localBg: colors.success[900], // #0E301B
  highlight: colors.warning[400], // #F59E0B
  highlightBg: colors.warning[700], // #B45309
  danger: colors.error[300], // #EDA088
  dangerBg: colors.error[900], // #4E1D17
  cardShadow: "rgba(0, 0, 0, 0.3)",
};
