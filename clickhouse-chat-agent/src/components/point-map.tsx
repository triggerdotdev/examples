"use client";

import type { LngLatBoundsLike } from "maplibre-gl";
import { Map, MapControls, MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/map";

type Point = {
  lat: number;
  lng: number;
  label?: string | null;
  value?: number | null;
};

// Marker diameter scales with sqrt(value) so area tracks magnitude.
const MIN_SIZE = 10;
const MAX_SIZE = 30;

export function PointMapView({ points, title }: { points: Point[]; title?: string | null }) {
  const valid = points.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lng) <= 180
  );
  if (valid.length === 0) {
    return <div className="text-sm text-muted-foreground">No mappable points.</div>;
  }

  const lngs = valid.map((p) => p.lng);
  const lats = valid.map((p) => p.lat);
  const bounds: LngLatBoundsLike = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];

  const maxValue = Math.max(...valid.map((p) => p.value ?? 0), 0);

  return (
    <div className="w-full space-y-2">
      {title && <h4 className="text-sm font-medium text-foreground">{title}</h4>}
      <Map
        bounds={bounds}
        fitBoundsOptions={{ padding: 48, maxZoom: 14 }}
        className="h-[360px] w-full overflow-hidden rounded-lg border"
      >
        <MapControls showZoom />
        {valid.map((point, i) => {
          const size =
            maxValue > 0 && point.value != null
              ? MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.sqrt(point.value / maxValue)
              : MIN_SIZE;
          return (
            <MapMarker key={i} longitude={point.lng} latitude={point.lat}>
              <MarkerContent>
                <div
                  className="rounded-full border-2 border-background shadow-md"
                  style={{
                    width: size,
                    height: size,
                    background: "var(--chart-1)",
                    opacity: 0.85,
                  }}
                />
              </MarkerContent>
              {(point.label || point.value != null) && (
                <MarkerTooltip>
                  <div className="rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
                    {point.label && <div className="font-medium">{point.label}</div>}
                    {point.value != null && (
                      <div className="text-muted-foreground">{point.value.toLocaleString()}</div>
                    )}
                  </div>
                </MarkerTooltip>
              )}
            </MapMarker>
          );
        })}
      </Map>
    </div>
  );
}
