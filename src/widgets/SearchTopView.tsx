import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { ArrowUpDown } from "lucide-react-native";
import { Header } from "../components/ui/Header";
import { InputField } from "../components/ui/InputField";
import { Accordion } from "../components/ui/Accordion";
import { HistoryItem } from "../components/ui/HistoryItem";
import { ActionFooter } from "../components/ui/ActionFooter";
import { colors } from "../shared/theme/colors";
import type { ComparisonHistoryItem } from "../contracts";

export type HistoryEntry = ComparisonHistoryItem;

interface HistoryRowProps {
  item: HistoryEntry;
  onSelect: (item: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

const MemoHistoryRow = React.memo(function MemoHistoryRow({
  item,
  onSelect,
  onDelete,
}: HistoryRowProps) {
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);
  const handleDelete = useCallback(() => onDelete(item.id), [onDelete, item.id]);

  return (
    <HistoryItem
      routeText={`${item.origin} → ${item.destination}`}
      metaText={`${item.vehicleType} • ${item.date}`}
      onPress={handlePress}
      onDeletePress={handleDelete}
    />
  );
});

interface HistorySectionProps {
  historyList: HistoryEntry[];
  onSelectHistory: (item: HistoryEntry) => void;
  onDeleteHistory: (id: string) => void;
}

const MemoHistorySection = React.memo(function MemoHistorySection({
  historyList,
  onSelectHistory,
  onDeleteHistory,
}: HistorySectionProps) {
  if (historyList.length === 0) return null;

  return (
    <View style={styles.historySection}>
      <Text style={styles.historySectionTitle}>最近の比較履歴</Text>
      <View style={styles.historyList}>
        {historyList.map((item) => (
          <MemoHistoryRow
            key={item.id}
            item={item}
            onSelect={onSelectHistory}
            onDelete={onDeleteHistory}
          />
        ))}
      </View>
    </View>
  );
});

export interface SearchTopViewProps {
  origin: string;
  destination: string;
  fuelEfficiency: string;
  fuelPrice: string;
  vehicleType: string;
  historyList: HistoryEntry[];
  isLoading?: boolean;
  isFetchingLocation?: boolean;
  conditionsAccordionInitiallyOpen?: boolean;
  onChangeOrigin: (text: string) => void;
  onChangeDestination: (text: string) => void;
  onSwapOriginDestination: () => void;
  onCurrentLocationPress: () => void;
  onMapSelectPress: (target: "origin" | "destination") => void;
  onEditConditionsPress: () => void;
  onSelectHistory: (item: HistoryEntry) => void;
  onDeleteHistory: (id: string) => void;
  onSubmit: () => void;
}

export const SearchTopView = React.memo(function SearchTopView({
  origin,
  destination,
  fuelEfficiency,
  fuelPrice,
  vehicleType,
  historyList,
  isLoading = false,
  isFetchingLocation = false,
  conditionsAccordionInitiallyOpen = true,
  onChangeOrigin,
  onChangeDestination,
  onSwapOriginDestination,
  onCurrentLocationPress,
  onMapSelectPress,
  onEditConditionsPress,
  onSelectHistory,
  onDeleteHistory,
  onSubmit,
}: SearchTopViewProps) {
  const isFormValid =
    origin.trim().length > 0 && destination.trim().length > 0 && !isFetchingLocation;

  const handleOpenOriginMap = useCallback(() => {
    onMapSelectPress("origin");
  }, [onMapSelectPress]);

  const handleOpenDestinationMap = useCallback(() => {
    onMapSelectPress("destination");
  }, [onMapSelectPress]);

  const accordionTitle = useMemo(
    () => `詳細条件 (${vehicleType} / ${fuelEfficiency}km/L)`,
    [vehicleType, fuelEfficiency],
  );

  const accordionItems = useMemo(
    () => [
      { label: "燃費", value: `${fuelEfficiency} km/L` },
      { label: "ガソリン単価", value: `${fuelPrice}円 / L` },
      { label: "車両条件", value: vehicleType },
    ],
    [fuelEfficiency, fuelPrice, vehicleType],
  );

  return (
    <View style={styles.container}>
      {/* Scrollable Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <Header tag="ROUTEIQ | CALM UTILITY" title="道路状況チェック" />

        {/* Input Group Card (Figma: input-group-card) */}
        <View style={styles.inputCard}>
          <Text style={styles.cardTitle}>ルート選択</Text>

          {/* 出発地 InputField */}
          <InputField
            label="出発地"
            value={origin}
            placeholder="出発地を入力（例: 東京駅）"
            state={isFetchingLocation ? "取得中" : "現在地ボタンあり"}
            onChangeText={onChangeOrigin}
            onCurrentLocationPress={onCurrentLocationPress}
            onMapSelectPress={handleOpenOriginMap}
          />

          {/* Swap Button (36x36 with 8pt hitSlop for 52pt touch target) */}
          <View style={styles.swapContainer}>
            <Pressable
              onPress={onSwapOriginDestination}
              style={({ pressed }) => [styles.swapButton, pressed && styles.swapButtonPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="出発地と目的地を入れ替える"
            >
              <ArrowUpDown size={16} color={colors.neutral[700]} />
            </Pressable>
          </View>

          {/* 目的地 InputField */}
          <InputField
            label="目的地"
            value={destination}
            placeholder="目的地を入力（例: 御殿場IC）"
            state="現在地ボタンなし"
            onChangeText={onChangeDestination}
            onMapSelectPress={handleOpenDestinationMap}
          />
        </View>

        {/* 詳細条件 Accordion (Figma: Accordion) */}
        <Accordion
          title={accordionTitle}
          initiallyOpen={conditionsAccordionInitiallyOpen}
          showEditButton={true}
          onEditPress={onEditConditionsPress}
          items={accordionItems}
        />

        {/* 最近の比較履歴 (Figma: recent-history) */}
        <MemoHistorySection
          historyList={historyList}
          onSelectHistory={onSelectHistory}
          onDeleteHistory={onDeleteHistory}
        />
      </ScrollView>

      {/* Sticky Bottom Action Footer */}
      <ActionFooter
        label="ルートを比較する"
        state={isLoading ? "Loading" : isFormValid ? "Default" : "Disabled"}
        loading={isLoading}
        disabled={!isFormValid || isLoading}
        onPress={onSubmit}
        style={styles.actionFooter}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50], // #f4f6f4
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  inputCard: {
    backgroundColor: colors.base.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.neutral[200], // #dce3dd
    padding: 20,
    gap: 12,
    // Figma drop shadow: [0px_8px_12px_rgba(0,0,0,0.03)]
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "bold",
    color: colors.neutral[900], // #1c2420
  },
  swapContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.base.white,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  swapButtonPressed: {
    backgroundColor: colors.neutral[100],
    transform: [{ scale: 0.94 }],
  },
  historySection: {
    gap: 8,
    width: "100%",
  },
  historySectionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "bold",
    color: colors.neutral[700], // #56625d
  },
  historyList: {
    gap: 8,
  },
  actionFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
});
