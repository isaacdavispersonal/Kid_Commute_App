// Admin vehicle management page
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AdminVehicles() {
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["/api/admin/vehicles"],
  });

  const columns = [
    {
      header: "Vehicle Name",
      accessor: "name",
    },
    {
      header: "Plate Number",
      accessor: "plateNumber",
    },
    {
      header: "Capacity",
      accessor: "capacity",
      cell: (value: number) => `${value} passengers`,
    },
    {
      header: "Status",
      accessor: "status",
      cell: (value: string) => <StatusBadge status={value as any} />,
    },
    {
      header: "Last Update",
      accessor: "lastLocationUpdate",
      cell: (value: string) => {
        if (!value) return "Never";
        return new Date(value).toLocaleString();
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Vehicle Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your fleet vehicles
          </p>
        </div>
        <Button data-testid="button-add-vehicle">
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={vehicles || []}
        isLoading={isLoading}
        emptyMessage="No vehicles found. Add your first vehicle to get started."
      />
    </div>
  );
}
