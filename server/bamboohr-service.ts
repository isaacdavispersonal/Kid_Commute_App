import type { PayrollExportEntry } from "@shared/schema";

interface BambooHRConfig {
  apiKey: string;
  subdomain: string;
}

interface BambooHRTimeEntry {
  employeeId: string;
  date: string;
  hours: number;
  overtimeHours?: number;
  doubleTimeHours?: number;
  note?: string;
}

interface BambooHRResponse {
  success: boolean;
  error?: string;
  entryId?: string;
}

/**
 * BambooHR API Service
 * Handles authentication and time entry submission to BambooHR
 */
export class BambooHRService {
  private apiKey: string;
  private subdomain: string;
  private baseUrl: string;

  constructor(config: BambooHRConfig) {
    this.apiKey = config.apiKey;
    this.subdomain = config.subdomain;
    this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${this.subdomain}`;
  }

  /**
   * Get authorization header for BambooHR API
   * BambooHR uses Basic Auth with API key as username and 'x' as password
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.apiKey}:x`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Submit a single time entry to BambooHR
   * 
   * @param entry - Time entry data from payroll calculation
   * @returns Response indicating success or failure
   */
  async submitTimeEntry(entry: BambooHRTimeEntry): Promise<BambooHRResponse> {
    try {
      const url = `${this.baseUrl}/v1/time_tracking/employees/${entry.employeeId}/entries`;
      
      const payload = {
        date: entry.date,
        hours: entry.hours,
        ...(entry.overtimeHours != null && { overtimeHours: entry.overtimeHours }),
        ...(entry.doubleTimeHours != null && { doubleTimeHours: entry.doubleTimeHours }),
        ...(entry.note && { note: entry.note }),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`BambooHR API Error (${response.status}):`, errorText);
        return {
          success: false,
          error: `API request failed with status ${response.status}: ${errorText}`,
        };
      }

      let result;
      try {
        const responseText = await response.text();
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.warn('BambooHR response not valid JSON, treating as success');
        result = {};
      }
      
      return {
        success: true,
        entryId: result.id || result.entryId || response.headers.get('Location')?.split('/').pop(),
      };
    } catch (error) {
      console.error('BambooHR API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Submit multiple time entries in batch
   * BambooHR doesn't support true batch operations, so we submit sequentially
   * with a small delay to avoid rate limiting
   * 
   * @param entries - Array of time entries to submit
   * @returns Array of responses for each entry
   */
  async submitTimeEntries(entries: BambooHRTimeEntry[]): Promise<BambooHRResponse[]> {
    const results: BambooHRResponse[] = [];
    
    for (const entry of entries) {
      const result = await this.submitTimeEntry(entry);
      results.push(result);
      
      // Small delay to avoid rate limiting (100ms between requests)
      if (entries.indexOf(entry) < entries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Convert payroll entry data to BambooHR time entry format
   * 
   * @param payrollEntry - Payroll entry from our system
   * @returns BambooHR time entry ready for submission
   */
  convertPayrollEntryToBambooHR(payrollEntry: PayrollExportEntry): BambooHRTimeEntry {
    const regularHours = typeof payrollEntry.regularHours === 'string' 
      ? parseFloat(payrollEntry.regularHours) 
      : payrollEntry.regularHours;
    const overtimeHours = typeof payrollEntry.overtimeHours === 'string'
      ? parseFloat(payrollEntry.overtimeHours)
      : (payrollEntry.overtimeHours === undefined || payrollEntry.overtimeHours === null) ? 0 : payrollEntry.overtimeHours;
    const doubleTimeHours = typeof payrollEntry.doubleTimeHours === 'string'
      ? parseFloat(payrollEntry.doubleTimeHours)
      : (payrollEntry.doubleTimeHours === undefined || payrollEntry.doubleTimeHours === null) ? 0 : payrollEntry.doubleTimeHours;
    const totalHours = typeof payrollEntry.totalHours === 'string'
      ? parseFloat(payrollEntry.totalHours)
      : payrollEntry.totalHours;

    if (isNaN(totalHours) || isNaN(regularHours) || 
        isNaN(overtimeHours || 0) || isNaN(doubleTimeHours || 0)) {
      throw new Error(`Invalid numeric values in payroll entry for date ${payrollEntry.date}`);
    }

    return {
      employeeId: payrollEntry.bambooEmployeeId,
      date: new Date(payrollEntry.date).toISOString().split('T')[0],
      hours: regularHours,
      overtimeHours,
      doubleTimeHours,
      note: `Auto-exported from Kid Commute - ${totalHours.toFixed(2)} total hours`,
    };
  }

  /**
   * Test the BambooHR API connection
   * Attempts to fetch employee directory (lightweight endpoint) to verify credentials
   * 
   * @returns True if connection is successful, false otherwise
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.baseUrl}/v1/employees/directory`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Authentication failed with status ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }
}

/**
 * Create a BambooHR service instance from environment variables
 * Requires BAMBOOHR_API_KEY and BAMBOOHR_SUBDOMAIN to be set
 */
export function createBambooHRService(): BambooHRService | null {
  const apiKey = process.env.BAMBOOHR_API_KEY;
  const subdomain = process.env.BAMBOOHR_SUBDOMAIN;

  if (!apiKey || !subdomain) {
    console.warn('BambooHR credentials not configured. Set BAMBOOHR_API_KEY and BAMBOOHR_SUBDOMAIN environment variables.');
    return null;
  }

  return new BambooHRService({ apiKey, subdomain });
}
