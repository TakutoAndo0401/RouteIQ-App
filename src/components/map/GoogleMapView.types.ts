import type { StyleProp, ViewStyle, DimensionValue } from "react-native";
import type { Coordinates } from "../../domain/location";

export interface GoogleMapViewProps {
  height?: DimensionValue;
  centerAddress?: string;
  pinLabel?: string;
  zoom?: number;
  showCenterPin?: boolean;
  showZoomControls?: boolean;
  isRouteMap?: boolean;
  originLabel?: string;
  destinationLabel?: string;
  originCoordinates?: Coordinates;
  destinationCoordinates?: Coordinates;
  routeCoordinates?: Array<{ lat: number; lng: number }> | Coordinates[];
  secondaryRouteCoordinates?: Array<{ lat: number; lng: number }> | Coordinates[];
  routeColor?: string;
  routeCasingColor?: string;
  initialCoordinates?: Coordinates;
  onLocationSelect?: (coords: Coordinates) => void;
  showExpandButton?: boolean;
  isExpanded?: boolean;
  onExpandPress?: () => void;
  showExternalButton?: boolean;
  onOpenExternal?: () => void;
  showFitButton?: boolean;
  style?: StyleProp<ViewStyle>;
}
