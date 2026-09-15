# RouteIQ-App: Agent Guidelines & Architecture Rules

This repository contains the mobile application for **RouteIQ** (Route Intelligence), a driving decision-support tool comparing Expressway vs. Local routes based on travel time, toll fares, fuel costs, traffic congestion, and the value of time saved.

---

## 1. Tech Stack & Environment

- **Framework**: Expo SDK 52 (`expo ~52.0.37`), React Native 0.76.9 (New Architecture enabled), React 18.3.1
- **Router**: Expo Router v4 (`expo-router ~4.0.17`)
- **Language**: TypeScript 5.3 (strict mode)
- **Validation**: Zod 3.24 (Single source of truth for schema & typing)
- **Icons & UI**: `lucide-react-native`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`
- **Package Manager**: `pnpm`
- **Testing & Quality**: `vitest`, `oxlint`, `oxfmt`, `expo-doctor`

---

## 2. Directory Structure Conventions

```
RouteIQ-App/
├── .agents/
│   ├── skills/              # Agent skills (expo-router, expo-native-ui, etc.)
│   └── mcp_config.json      # MCP server configurations (Figma, Expo MCP)
├── app/                     # Expo Router routes ONLY. Do not place business logic or models here.
│   ├── _layout.tsx          # Root provider hierarchy (SafeAreaProvider, HarnessProvider, Stack)
│   └── index.tsx            # Main route comparison screen
├── src/
│   ├── contracts/           # Zod schemas & shared data contracts (Single Source of Truth)
│   ├── domain/              # Pure domain logic (cost calculations, comparison math, algorithms)
│   ├── harness/             # Mock harness & fixtures for UI development and offline testing
│   ├── shared/              # Shared themes, design tokens, utility helpers
│   └── widgets/             # Reusable UI components & screen sections
├── tests/                   # Vitest unit and integration test suites
└── package.json
```

---

## 3. Core Development Principles

### 1. Contract-First Architecture (`src/contracts/`)

- All request/response payloads, calculation models, and API interfaces **MUST** have a corresponding Zod schema in `src/contracts/`.
- Infer TypeScript types directly from Zod schemas using `z.infer<typeof schema>`. Never duplicate type definitions manually.

### 2. Mock Harness Pattern (`src/harness/`)

- Maintain support for development and testing via `HarnessContext` and `mockClient.ts`.
- Ensure new features or comparison models work with mock fixtures before integrating external routing/traffic APIs.

### 3. Screen States & Reliability

- Follow the 4-state screen standard: **Loading**, **Content**, **Empty**, and **Error**.
- Always provide user-friendly error views with a retry mechanism (`fetchRouteAnalysis`).

### 4. Native-First UI & Theming

- Support both Light and Dark themes via `lightTheme` and `darkTheme` from `src/shared/theme.ts`.
- Ensure interactive elements adhere to minimum touch target guidelines (min 44x44 pt).
- Use `SafeAreaView` from `react-native-safe-area-context` to avoid notches and navigation bars.

### 5. Expo Skills Reference

Refer to the official skills located in `.agents/skills/` when implementing changes:

- `expo-router`: For adding new screens, tabs, dynamic routes, or modals.
- `expo-native-ui`: For native UI controls, SF Symbols, haptics, and Apple HIG patterns.
- `expo-data-fetching`: For network calls, TanStack Query integration, caching, and offline support.
- `expo-dom`: For embedding web charts (Recharts, Chart.js) or web-only components into native views.

---

## 4. Verification & Testing

Always verify changes by running the project check command:

```bash
# Run lint, format check, TypeScript check, and Vitest suite
pnpm check

# Run individual checks
pnpm lint
pnpm fmt:check
pnpm typecheck
pnpm test
```
