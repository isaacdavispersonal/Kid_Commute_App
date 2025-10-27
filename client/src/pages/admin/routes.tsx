// Admin route management page
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";

export default function AdminRoutes() {
  const { data: routes, isLoading } = useQuery({
    queryKey: ["/api/admin/routes"],
  });

  const columns = [
    {
      header: "Route Name",
      accessor: "name",
    },
    {
      header: "Description",
      accessor: "description",
      cell: (value: string) => value || "—",
    },
    {
      header: "Stops",
      accessor: "stopCount",
      cell: (value: number) => (
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {value || 0} stops
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "isActive",
      cell: (value: boolean) => (
        <StatusBadge status={value ? "active" : "inactive"} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Route Management</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage transportation routes
          </p>
        </div>
        <Button data-testid="button-add-route">
          <Plus className="h-4 w-4 mr-2" />
          Add Route
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={routes || []}
        isLoading={isLoading}
        emptyMessage="No routes found. Create your first route to get started."
      />
    </div>
  );
}
