import type { LocationGeocodedAddress } from "expo-location";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type GeocodedAddressInput = Partial<LocationGeocodedAddress>;

/**
 * expo-location の reverseGeocode 結果から日本の住所文字列をフォーマットします。
 */
export function formatGeocodedAddress(item: GeocodedAddressInput): string {
  const parts: string[] = [];

  const region = item.region || "";
  const city = item.city || "";
  const subregion = item.subregion || "";
  const district = item.district || "";
  const street = item.street || "";
  const streetNumber = item.streetNumber || "";
  const name = item.name || "";

  if (region) {
    parts.push(region);
  }

  // 市区町村の重複を考慮した結合
  let locality = "";
  if (subregion && city && subregion.startsWith(city)) {
    locality = subregion;
  } else if (city && subregion && !city.includes(subregion) && !subregion.includes(city)) {
    locality = `${city}${subregion}`;
  } else {
    locality = city || subregion;
  }

  if (locality) {
    // region が既に含まれている場合は重複を排除
    if (region && locality.startsWith(region)) {
      locality = locality.slice(region.length);
    }
    parts.push(locality);
  }

  // street / district
  const streetPart = street || district;
  if (streetPart && !parts.some((p) => p.includes(streetPart))) {
    parts.push(streetPart);
  }

  // streetNumber or name
  if (streetNumber && !parts.some((p) => p.includes(streetNumber))) {
    parts.push(streetNumber);
  } else if (
    name &&
    !parts.some((p) => p.includes(name)) &&
    name !== street &&
    name !== city &&
    name !== region
  ) {
    parts.push(name);
  }

  const result = parts.join("").trim();
  return result;
}

/**
 * 緯度・経度からフォールバック用の文字列表現を生成します。
 */
export function formatFallbackCoordinates(coords: Coordinates): string {
  const latDirection = coords.latitude >= 0 ? "北緯" : "南緯";
  const lonDirection = coords.longitude >= 0 ? "東経" : "西経";
  const latStr = Math.abs(coords.latitude).toFixed(3);
  const lonStr = Math.abs(coords.longitude).toFixed(3);
  return `現在地 (${latDirection}${latStr}°, ${lonDirection}${lonStr}°)`;
}

/**
 * Web環境などで reverseGeocodeAsync が利用できない場合の外部フォールバック
 */
export async function fetchWebReverseGeocode(coords: Coordinates): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=ja`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "RouteIQ-App/1.0",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        province?: string;
        city?: string;
        subregion?: string;
        suburb?: string;
        neighbourhood?: string;
        quarter?: string;
        road?: string;
        house_number?: string;
      };
    };

    if (data.address) {
      const addr = data.address;
      const parts = [
        addr.province || "",
        addr.city || addr.subregion || "",
        addr.suburb || "",
        addr.quarter || addr.neighbourhood || "",
        addr.road || "",
        addr.house_number || "",
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join("");
      }
    }
    if (data.display_name) {
      const firstPart = data.display_name.split(",")[0]?.trim();
      return firstPart || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 主要ICおよびランドマークの事前定義座標
 */
export const KNOWN_LOCATIONS: Record<string, Coordinates> = {
  // 高速道路主要IC / SA
  用賀IC: { latitude: 35.6266, longitude: 139.63 },
  用賀: { latitude: 35.6266, longitude: 139.63 },
  御殿場IC: { latitude: 35.2974, longitude: 138.9348 },
  御殿場: { latitude: 35.2974, longitude: 138.9348 },
  横浜IC: { latitude: 35.503, longitude: 139.508 },
  海老名SA: { latitude: 35.4336, longitude: 139.3957 },
  海老名IC: { latitude: 35.4336, longitude: 139.3957 },
  海老名: { latitude: 35.4336, longitude: 139.3957 },
  厚木IC: { latitude: 35.4433, longitude: 139.3625 },
  厚木: { latitude: 35.4433, longitude: 139.3625 },
  足柄SA: { latitude: 35.3105, longitude: 138.9818 },
  足柄: { latitude: 35.3105, longitude: 138.9818 },
  沼津IC: { latitude: 35.103, longitude: 138.8631 },
  沼津: { latitude: 35.103, longitude: 138.8631 },
  富士IC: { latitude: 35.1613, longitude: 138.6764 },
  富士: { latitude: 35.1613, longitude: 138.6764 },
  静岡IC: { latitude: 34.9756, longitude: 138.3828 },
  静岡: { latitude: 34.9756, longitude: 138.3828 },

  // 都心部・千代田区・中央区
  東京駅: { latitude: 35.6812, longitude: 139.7671 },
  丸の内: { latitude: 35.6812, longitude: 139.7671 },
  大手町: { latitude: 35.6865, longitude: 139.7644 },
  永代通り: { latitude: 35.6835, longitude: 139.768 },
  千代田区: { latitude: 35.694, longitude: 139.7536 },
  千代田: { latitude: 35.694, longitude: 139.7536 },
  八重洲: { latitude: 35.68, longitude: 139.771 },
  有楽町: { latitude: 35.6751, longitude: 139.7634 },
  銀座: { latitude: 35.6719, longitude: 139.7648 },
  日本橋: { latitude: 35.6826, longitude: 139.7744 },
  霞が関: { latitude: 35.6756, longitude: 139.7505 },
  永田町: { latitude: 35.6787, longitude: 139.7447 },
  中央区: { latitude: 35.6707, longitude: 139.772 },

  // 港区・渋谷区・新宿区
  虎ノ門: { latitude: 35.6698, longitude: 139.7497 },
  新橋: { latitude: 35.6664, longitude: 139.7583 },
  港区: { latitude: 35.6581, longitude: 139.7515 },
  六本木: { latitude: 35.6628, longitude: 139.7314 },
  赤坂: { latitude: 35.6723, longitude: 139.7344 },
  品川区: { latitude: 35.6284, longitude: 139.7387 },
  品川: { latitude: 35.6284, longitude: 139.7387 },
  大崎: { latitude: 35.6197, longitude: 139.7282 },
  五反田: { latitude: 35.6264, longitude: 139.7234 },
  目黒区: { latitude: 35.6339, longitude: 139.7158 },
  目黒: { latitude: 35.6339, longitude: 139.7158 },
  渋谷区: { latitude: 35.658, longitude: 139.7016 },
  渋谷: { latitude: 35.658, longitude: 139.7016 },
  原宿: { latitude: 35.6702, longitude: 139.7027 },
  恵比寿: { latitude: 35.6467, longitude: 139.7101 },
  新宿区: { latitude: 35.6909, longitude: 139.7003 },
  新宿: { latitude: 35.6909, longitude: 139.7003 },

  // 東京その他主要エリア
  池袋: { latitude: 35.7295, longitude: 139.7109 },
  豊島区: { latitude: 35.7313, longitude: 139.7176 },
  上野: { latitude: 35.7141, longitude: 139.7774 },
  台東区: { latitude: 35.7126, longitude: 139.78 },
  秋葉原: { latitude: 35.6984, longitude: 139.7731 },
  浅草: { latitude: 35.7118, longitude: 139.7967 },
  文京区: { latitude: 35.7078, longitude: 139.7523 },
  墨田区: { latitude: 35.7107, longitude: 139.8165 },
  錦糸町: { latitude: 35.6968, longitude: 139.8144 },
  押上: { latitude: 35.7106, longitude: 139.8131 },
  江東区: { latitude: 35.6731, longitude: 139.8172 },
  豊洲: { latitude: 35.6554, longitude: 139.7968 },
  お台場: { latitude: 35.6298, longitude: 139.7758 },
  世田谷区: { latitude: 35.6466, longitude: 139.6532 },
  世田谷: { latitude: 35.6466, longitude: 139.6532 },
  三軒茶屋: { latitude: 35.6436, longitude: 139.6713 },
  二子玉川: { latitude: 35.6116, longitude: 139.6268 },
  大田区: { latitude: 35.5613, longitude: 139.7161 },
  羽田空港: { latitude: 35.5494, longitude: 139.7798 },
  羽田: { latitude: 35.5494, longitude: 139.7798 },
  蒲田: { latitude: 35.5625, longitude: 139.7161 },
  中野区: { latitude: 35.7075, longitude: 139.6638 },
  中野: { latitude: 35.7075, longitude: 139.6638 },
  杉並区: { latitude: 35.6995, longitude: 139.6364 },
  杉並: { latitude: 35.6995, longitude: 139.6364 },
  荻窪: { latitude: 35.7045, longitude: 139.6201 },
  北区: { latitude: 35.7528, longitude: 139.7337 },
  赤羽: { latitude: 35.7779, longitude: 139.7209 },
  板橋区: { latitude: 35.7512, longitude: 139.7093 },
  練馬区: { latitude: 35.7356, longitude: 139.6517 },
  練馬: { latitude: 35.7356, longitude: 139.6517 },
  足立区: { latitude: 35.775, longitude: 139.8044 },
  北千住: { latitude: 35.7494, longitude: 139.805 },
  葛飾区: { latitude: 35.7434, longitude: 139.8472 },
  江戸川区: { latitude: 35.6592, longitude: 139.8647 },

  // 神奈川・近郊
  横浜: { latitude: 35.4437, longitude: 139.638 },
  みなとみらい: { latitude: 35.4578, longitude: 139.6324 },
  川崎市: { latitude: 35.5308, longitude: 139.7029 },
  川崎: { latitude: 35.5308, longitude: 139.7029 },
  武蔵小杉: { latitude: 35.5768, longitude: 139.6587 },
  中原区: { latitude: 35.5768, longitude: 139.6587 },
  相模原: { latitude: 35.5714, longitude: 139.3731 },
  小田原: { latitude: 35.2558, longitude: 139.1598 },
  箱根: { latitude: 35.2324, longitude: 139.0416 },

  // 千葉・埼玉・他
  幕張: { latitude: 35.6508, longitude: 140.0381 },
  成田空港: { latitude: 35.7653, longitude: 140.3856 },
  成田: { latitude: 35.7653, longitude: 140.3856 },
  千葉: { latitude: 35.6074, longitude: 140.1065 },
  大宮: { latitude: 35.9063, longitude: 139.624 },
  さいたま: { latitude: 35.9063, longitude: 139.624 },
  浦和: { latitude: 35.8598, longitude: 139.6571 },
  浜松: { latitude: 34.7108, longitude: 137.7261 },
  名古屋: { latitude: 35.1815, longitude: 136.9066 },
};

/**
 * 住所文字列から緯度経度を解決します。
 */
export async function geocodeAddress(address: string): Promise<Coordinates> {
  const clean = address.replace(/\s*\([^)]*\)/g, "").trim();
  if (!clean) {
    return { latitude: 35.6812, longitude: 139.7671 };
  }

  // 0. 緯度経度表記のパース (例: 北緯35.123, 東経139.456)
  const coordMatch = clean.match(
    /(?:北緯|lat:?\s*)?(-?\d+\.\d+)[°,\s]+(?:東経|lng:?\s*|lon:?\s*)?(-?\d+\.\d+)/,
  );
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 1. 事前定義の既知地点からマッチング（具体的ランドマーク・駅・ICを行政区よりも優先し、キー長順に評価）
  const sortedEntries = Object.entries(KNOWN_LOCATIONS).sort((a, b) => {
    const isAreaA = a[0].endsWith("区") || a[0].endsWith("市");
    const isAreaB = b[0].endsWith("区") || b[0].endsWith("市");
    if (isAreaA !== isAreaB) {
      return isAreaA ? 1 : -1;
    }
    return b[0].length - a[0].length;
  });
  for (const [key, coords] of sortedEntries) {
    if (clean.includes(key) || key.includes(clean)) {
      return coords;
    }
  }

  // 2. expo-location でジオコーディング
  try {
    const Location = await import("expo-location");
    const results = await Location.geocodeAsync(clean);
    if (results && results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    }
  } catch {
    // Web環境等のフォールバックへ進む
  }

  // 3. Nominatim API でジオコーディング
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&accept-language=ja&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RouteIQ-App/1.0" },
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }
    }
  } catch {
    // フォールバック
  }

  return { latitude: 35.6812, longitude: 139.7671 };
}

/**
 * 座標から住所文字列を解決します。
 */
export async function reverseGeocodeCoordinates(coords: Coordinates): Promise<string> {
  // 1. expo-location 逆ジオコーディング
  try {
    const Location = await import("expo-location");
    const results = await Location.reverseGeocodeAsync(coords);
    if (results && results.length > 0) {
      const formatted = formatGeocodedAddress(results[0]);
      if (formatted.length > 0) {
        return formatted;
      }
    }
  } catch {
    // Web環境等
  }

  // 2. Nominatim 逆ジオコーディング
  const webAddress = await fetchWebReverseGeocode(coords);
  if (webAddress) {
    return webAddress;
  }

  // 3. フォールバック座標表記
  return formatFallbackCoordinates(coords);
}

export interface CurrentLocationResult {
  address: string;
  coords: Coordinates;
}

/**
 * 現在地の緯度経度および住所文字列を取得します。
 */
export async function getCurrentLocationWithCoords(): Promise<CurrentLocationResult> {
  const Location = await import("expo-location");

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("位置情報の利用が許可されていません。設定から許可してください。");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const coords: Coordinates = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };

  const address = await reverseGeocodeCoordinates(coords);
  return { address, coords };
}

/**
 * 現在地を取得し、その場所の住所文字列を返します。
 * パーミッション未許可時や取得失敗時は例外をスローします。
 */
export async function getCurrentLocationAddress(): Promise<string> {
  const result = await getCurrentLocationWithCoords();
  return result.address;
}

/**
 * 2地点間のGoogle Maps運転ナビゲーションディープリンクURLを生成します。
 */
export function buildGoogleMapsDirectionsUrl(origin: string, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/**
 * 地名テキストから事前定義の既知地点座標を解決します。見つからない場合は defaultCoords を返します。
 */
export function resolveCoordinatesFromText(
  text: string | undefined,
  defaultCoords: Coordinates,
): Coordinates {
  if (!text) return defaultCoords;
  const clean = text.replace(/\s*\([^)]*\)/g, "").trim();

  // 0. 緯度経度表記のパース (例: 北緯35.123, 東経139.456)
  const coordMatch = clean.match(
    /(?:北緯|lat:?\s*)?(-?\d+\.\d+)[°,\s]+(?:東経|lng:?\s*|lon:?\s*)?(-?\d+\.\d+)/,
  );
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 1. 事前定義の既知地点からマッチング（具体的ランドマーク・駅・ICを行政区よりも優先し、キー長順に評価）
  const sortedEntries = Object.entries(KNOWN_LOCATIONS).sort((a, b) => {
    const isAreaA = a[0].endsWith("区") || a[0].endsWith("市");
    const isAreaB = b[0].endsWith("区") || b[0].endsWith("市");
    if (isAreaA !== isAreaB) {
      return isAreaA ? 1 : -1;
    }
    return b[0].length - a[0].length;
  });
  for (const [key, coords] of sortedEntries) {
    if (clean.includes(key)) {
      return coords;
    }
  }

  return defaultCoords;
}
