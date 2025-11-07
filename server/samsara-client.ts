import { log } from "./vite";

interface SamsaraVehicleLocation {
  id: string;
  name: string;
  gps?: Array<{
    time: string;
    latitude: number;
    longitude: number;
    speedMilesPerHour?: number;
    headingDegrees?: number;
  }>;
}

interface SamsaraStatsResponse {
  data: SamsaraVehicleLocation[];
  pagination: {
    endCursor: string;
    hasNextPage: boolean;
  };
}

export class SamsaraClient {
  private readonly apiToken: string;
  private readonly baseUrl = "https://api.samsara.com";
  private lastCursor: string = "";

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async getVehicleLocationsFeed(): Promise<{
    vehicles: Array<{
      samsaraId: string;
      name: string;
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      timestamp: Date;
    }>;
    cursor: string;
    hasMore: boolean;
  }> {
    try {
      const url = new URL(`${this.baseUrl}/fleet/vehicles/stats/feed`);
      url.searchParams.append("types", "gps");
      
      if (this.lastCursor) {
        url.searchParams.append("after", this.lastCursor);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Samsara API error: ${response.status} - ${errorText}`);
      }

      const data: SamsaraStatsResponse = await response.json();

      const vehicles = data.data
        .filter(v => v.gps && v.gps.length > 0)
        .map(v => {
          const latestGps = v.gps![0];
          return {
            samsaraId: v.id,
            name: v.name,
            latitude: latestGps.latitude,
            longitude: latestGps.longitude,
            speed: latestGps.speedMilesPerHour,
            heading: latestGps.headingDegrees,
            timestamp: new Date(latestGps.time),
          };
        });

      this.lastCursor = data.pagination.endCursor;

      return {
        vehicles,
        cursor: data.pagination.endCursor,
        hasMore: data.pagination.hasNextPage,
      };
    } catch (error) {
      log(`[samsara] Error fetching vehicle locations: ${error}`, "error");
      throw error;
    }
  }

  async getAllVehicles(): Promise<Array<{
    samsaraId: string;
    name: string;
    vin?: string;
    licensePlate?: string;
    make?: string;
    model?: string;
    year?: string;
  }>> {
    try {
      const response = await fetch(`${this.baseUrl}/fleet/vehicles`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Samsara API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return data.data.map((v: any) => ({
        samsaraId: v.id,
        name: v.name,
        vin: v.vin,
        licensePlate: v.licensePlate,
        make: v.make,
        model: v.model,
        year: v.year,
      }));
    } catch (error) {
      log(`[samsara] Error fetching all vehicles: ${error}`, "error");
      throw error;
    }
  }

  setCursor(cursor: string) {
    this.lastCursor = cursor;
  }
}

export const samsaraClient = process.env.SAMSARA_API_TOKEN
  ? new SamsaraClient(process.env.SAMSARA_API_TOKEN)
  : null;
