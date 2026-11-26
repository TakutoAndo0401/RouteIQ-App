# RouteIQ-App

**RouteIQ** は、高速道路と一般道のルート比較を行い、「移動時間」「高速料金」「ガソリン代」「渋滞リスク」「浮いた時間の価値」を総合的に可視化してドライバーの意思決定を支援するモバイルアプリケーションです。

---

## 主な機能

- **高速 vs 一般道の比較判定（Gemini Decisions API 対応）**:
  所要時間の差、高速道路料金、燃料消費量（車種・燃費・ガソリン単価から精密計算）、渋滞度、および優先方針（バランス / 時間優先 / 費用優先）をもとに、Google AI Studio の **Decisions API (`gemini-decision-1`)** が高速・一般道のどちらを使うべきかを確信度・支持確率付きで判定（未設定・障害時は標準ルールへ自動フォールバック）。
- **リアルタイム交通情報・渋滞分析**:
  Google Routes API と連携し、区間ごとの交通状況や遅延要因を可視化。
- **インタラクティブ地図**:
  WebView（Leaflet / OpenStreetMap）によるルート表示・ピン選択機能。
- **車両条件の柔軟なカスタマイズ**:
  燃費、ガソリン価格、車両区分（軽自動車・普通車・中型車等）に合わせたコスト試算。

---

## 技術スタック

- **Framework**: Expo SDK 52 (React Native 0.76, New Architecture 有効)
- **Router**: Expo Router v4
- **Language**: TypeScript (Strict Mode)
- **Validation**: Zod 3.24 (Contract-First Architecture)
- **Icons**: `lucide-react-native`
- **Package Manager**: `pnpm`
- **Testing & Quality**: `vitest`, `oxlint`, `oxfmt`, `expo-doctor`

---

## クイックスタート

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、Google Maps Routes API キーを設定してください。

```bash
cp .env.example .env
```

`.env` の内容:

```bash
# Google Cloud Console で「Routes API」を有効化して取得した API キー
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...

# Google AI Studio で取得した Gemini API キー（Decisions API による高速/一般道判定用・任意）
# 未設定または障害時は既存のルールベース判定へ自動フォールバックします
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSy...
```

> **Note**: Google Cloud Console 側で、API キーに適切な制限（Routes API のみへの制限、Android/iOS アプリ制限など）を設定することを強く推奨します。

### 3. 開発サーバーの起動

```bash
# Web 版で起動
pnpm web

# iOS シミュレーターで起動
pnpm ios

# Android エミュレーターで起動
pnpm android

# Expo 開発メニュー起動
pnpm dev
```

---

## テスト・品質検証

```bash
# 全体チェック（Linter + フォーマッタ + 型チェック + Vitest テスト）
pnpm check

# 個別コマンド
pnpm test        # Vitest 単体・統合テスト
pnpm typecheck   # TypeScript 型チェック
pnpm lint        # Oxlint コード静的解析
pnpm fmt:check   # Oxfmt コードフォーマット検証
```
