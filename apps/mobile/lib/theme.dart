import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class AetherionColors {
  static const background = Color(0xFF0B1220);
  static const surface = Color(0xFF111827);
  static const surfaceHigh = Color(0xFF1F2937);
  static const accent = Color(0xFF2DD4BF);
  static const gold = Color(0xFFD4A574);
  static const textPrimary = Color(0xFFF1F5F9);
  static const textMuted = Color(0xFF94A3B8);
  static const danger = Color(0xFFF87171);
}

ThemeData buildAetherionTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.dark(
      surface: AetherionColors.surface,
      primary: AetherionColors.accent,
      secondary: AetherionColors.gold,
      onSurface: AetherionColors.textPrimary,
      onPrimary: AetherionColors.background,
    ),
    scaffoldBackgroundColor: AetherionColors.background,
    cardColor: AetherionColors.surfaceHigh,
    dividerColor: AetherionColors.surfaceHigh,
  );

  final cairoFamily = GoogleFonts.cairo().fontFamily;

  return base.copyWith(
    textTheme: base.textTheme.apply(fontFamily: cairoFamily),
    primaryTextTheme: base.primaryTextTheme.apply(fontFamily: cairoFamily),
    appBarTheme: AppBarTheme(
      backgroundColor: AetherionColors.background,
      foregroundColor: AetherionColors.textPrimary,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.cairo(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: AetherionColors.gold,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AetherionColors.accent,
        foregroundColor: AetherionColors.background,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.cairo(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AetherionColors.accent,
        side: const BorderSide(color: AetherionColors.accent, width: 1.5),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.cairo(fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AetherionColors.surfaceHigh,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      hintStyle: GoogleFonts.cairo(color: AetherionColors.textMuted),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AetherionColors.surfaceHigh,
      contentTextStyle: GoogleFonts.cairo(color: AetherionColors.textPrimary),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
