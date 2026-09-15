import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Animated } from "react-native";
import { BackHeader, ActionFooter } from "../components/ui";
import { colors } from "../shared/theme/colors";

export interface LoadingSkeletonViewProps {
  onBackPress?: () => void;
}

export function LoadingSkeletonView({ onBackPress }: LoadingSkeletonViewProps) {
  const [pulseAnim] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <BackHeader title="比較結果" backLabel="戻る" onBackPress={onBackPress} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Card 1: AlertBanner Skeleton (Figma 118:224) */}
        <View style={styles.card}>
          <View style={styles.bannerRow}>
            <Animated.View
              style={[styles.skeletonCircle, { opacity: pulseAnim, width: 24, height: 24 }]}
            />
            <Animated.View
              style={[styles.skeletonBlock, { opacity: pulseAnim, width: 180, height: 16 }]}
            />
          </View>
          <Animated.View
            style={[styles.skeletonBlock, { opacity: pulseAnim, width: "100%", height: 12 }]}
          />
          <Animated.View
            style={[styles.skeletonBlock, { opacity: pulseAnim, width: 120, height: 12 }]}
          />
        </View>

        {/* Card 2: Distance Strip Skeleton (Figma 118:230) */}
        <View style={styles.distanceCard}>
          <Animated.View
            style={[styles.skeletonBlock, { opacity: pulseAnim, width: "100%", height: 14 }]}
          />
        </View>

        {/* Card 3: Highway Card Skeleton (Figma 118:232) */}
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.skeletonPill,
              { opacity: pulseAnim, width: 100, height: 16, borderRadius: 100 },
            ]}
          />
          <View style={styles.metaRow}>
            <Animated.View
              style={[styles.skeletonBlock, { opacity: pulseAnim, width: 140, height: 24 }]}
            />
            <Animated.View
              style={[styles.skeletonBlock, { opacity: pulseAnim, width: 80, height: 14 }]}
            />
          </View>
          <View style={styles.divider} />
          <Animated.View
            style={[styles.skeletonBlock, { opacity: pulseAnim, width: "100%", height: 40 }]}
          />
        </View>

        {/* Card 4: General Card Skeleton (Figma 118:239) */}
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.skeletonPill,
              { opacity: pulseAnim, width: 100, height: 16, borderRadius: 100 },
            ]}
          />
          <Animated.View
            style={[styles.skeletonBlock, { opacity: pulseAnim, width: 120, height: 24 }]}
          />
        </View>

        {/* Card 5: Map Placeholder Skeleton (Figma 118:242) */}
        <View style={styles.card}>
          <Animated.View
            style={[styles.skeletonBlock, { opacity: pulseAnim, width: 80, height: 14 }]}
          />
          <Animated.View
            style={[
              styles.skeletonBlock,
              { opacity: pulseAnim, width: "100%", height: 110, borderRadius: 12 },
            ]}
          />
        </View>
      </ScrollView>

      {/* 固定フッター (Loading状態) (Figma 271:740) */}
      <ActionFooter
        label="ルートを比較する"
        state="Loading"
        loading={true}
        loadingText="最適なルートを計算中..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50], // #f4f6f4
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200], // #dce3dd
    borderRadius: 20,
    padding: 16,
    gap: 12,
    width: "100%",
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  distanceCard: {
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 16,
    padding: 12,
    width: "100%",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[200],
    width: "100%",
  },
  skeletonBlock: {
    backgroundColor: colors.neutral[200], // #dce3dd
    borderRadius: 8,
  },
  skeletonCircle: {
    backgroundColor: colors.neutral[200],
    borderRadius: 99,
  },
  skeletonPill: {
    backgroundColor: colors.neutral[200],
  },
});
