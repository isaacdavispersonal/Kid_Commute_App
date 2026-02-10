import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Download, Link2 } from "lucide-react";
import AdminTimesheets from "./admin-timesheets";
import AdminPayrollExports from "./payroll-exports";
import BambooHRSettings from "./bamboohr-settings";

export default function AdminPayroll() {
  const [activeTab, setActiveTab] = useState("timesheets");

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden px-4 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold mb-1" data-testid="heading-payroll">
          Payroll
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage timesheets, exports, and BambooHR integration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-auto min-w-max">
            <TabsTrigger value="timesheets" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4" data-testid="tab-payroll-timesheets">
              <Clock className="h-4 w-4" />
              Timesheets
            </TabsTrigger>
            <TabsTrigger value="exports" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4" data-testid="tab-payroll-exports">
              <Download className="h-4 w-4" />
              Exports
            </TabsTrigger>
            <TabsTrigger value="bamboohr" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4" data-testid="tab-payroll-bamboohr">
              <Link2 className="h-4 w-4" />
              BambooHR
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="timesheets" className="mt-4">
          <AdminTimesheets embedded />
        </TabsContent>

        <TabsContent value="exports" className="mt-4">
          <AdminPayrollExports embedded />
        </TabsContent>

        <TabsContent value="bamboohr" className="mt-4">
          <BambooHRSettings embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
