import { customType } from 'drizzle-orm/pg-core';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * PostGIS geography(Point, 4326) column type.
 * Expects/returns GeoJSON or WKT POINT(lng lat) via SQL helpers.
 */
export const geographyPoint = customType<{
  data: GeoPoint;
  driverData: string;
}>({
  dataType() {
    return 'geography(Point, 4326)';
  },
  toDriver(value: GeoPoint): string {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value: string): GeoPoint {
    // Handle WKT "POINT(lng lat)" if returned as text
    const match = /POINT\(([-\d.]+)\s+([-\d.]+)\)/i.exec(value);
    if (match && match[1] && match[2]) {
      return { lng: Number(match[1]), lat: Number(match[2]) };
    }
    return { lat: 0, lng: 0 };
  },
});

