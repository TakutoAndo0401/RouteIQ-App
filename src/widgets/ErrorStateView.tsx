import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloudOff, AlertTriangle } from "lucide-react-native";
import { BackHeader, Button } from "../components/ui";
import { colors } from "../shared/theme/colors";

export type ErrorType = "network" | "not_found" | "rate_limit" | "server" | "unknown";

export interface ErrorStateViewProps {
  type: ErrorType;
  title?: string;
  message?: string;
  recovery?: string;
  actionButtonLabel?: string;
  onBackPress?: () => void;
  onActionPress?: () => void;
  onFooterPress?: () => void;
}

export function ErrorStateView({
  type,
  title: customTitle,
  message: customMessage,
  recovery,
  actionButtonLabel: customActionButtonLabel,
  onBackPress,
  onActionPress,
}: ErrorStateViewProps) {
  const insets = useSafeAreaInsets();
  const isNetwork = type === "network";

  const defaultTitle = (() => {
    switch (type) {
      case "network":
        return "接続できませんでした";
      case "rate_limit":
        return "リクエストが集中しています";
      case "server":
        return "サーバーエラーが発生しました";
      case "not_found":
      default:
        return "ルートが見つかりませんでした";
    }
  })();

  const defaultMessage = (() => {
    switch (type) {
      case "network":
        return "ネットワーク接続を確認してから、もう一度お試しください。";
      case "rate_limit":
        return "アクセスが集中しているため、1分ほど待ってから再試行してください。";
      case "server":
        return "サーバー側で処理を完了できませんでした。時間をおいて再試行してください。";
      case "not_found":
      default:
        return "指定された地点間のルートが見つかりませんでした。出発地または目的地を変更してお試しください。";
    }
  })();

  const title = customTitle || defaultTitle;
  const message = customMessage || defaultMessage;
  const actionButtonLabel =
    customActionButtonLabel ||
    (isNetwork || type === "rate_limit" || type === "server" ? "再試行" : "条件を変更する");

  return (
    <View style={styles.container}>
      <BackHeader title="比較結果" backLabel="戻る" onBackPress={onBackPress} />

      <View style={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
        {/* 丸型アイコンコンテナ (Figma 118:268 / 118:297) */}
        <View style={styles.iconContainer}>
          {isNetwork ? (
            <CloudOff size={32} color={colors.primary[500]} />
          ) : (
            <AlertTriangle size={32} color={colors.primary[500]} />
          )}
        </View>

        {/* テキストグループ (Figma 118:271 / 118:300) */}
        <View style={styles.textGroup}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {recovery ? <Text style={styles.recovery}>{recovery}</Text> : null}
        </View>

        {/* アクションボタン (Figma 244:907 / 244:909) */}
        <Button
          label={actionButtonLabel}
          state="Compact"
          onPress={onActionPress}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50], // #f4f6f4
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: colors.neutral[100], // #e8efe9
    alignItems: "center",
    justifyContent: "center",
  },
  textGroup: {
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.neutral[900], // #1c2420
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[700], // #56625d
    textAlign: "center",
  },
  recovery: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.neutral[500],
    textAlign: "center",
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 28,
    minWidth: 160,
  },
});
