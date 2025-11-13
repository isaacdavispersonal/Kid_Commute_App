import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, CheckCircle, AlertTriangle, MapPin, Users, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Stop {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  region?: string;
}

interface Student {
  firstName: string;
  lastName: string;
  guardianPhones: string[];
  guardianNames?: string;
}

interface StopsPreviewResponse {
  success: boolean;
  stops: Stop[];
  errors: string[];
}

interface StudentsPreviewResponse {
  success: boolean;
  students: Student[];
  errors: string[];
}

interface StopsCommitResponse {
  success: boolean;
  created: Stop[];
  skipped: Array<{ message: string }>;
  warnings: string[];
  source: string;
}

interface StudentsCommitResponse {
  success: boolean;
  created: Student[];
  skipped: Array<{ message: string }>;
  warnings: string[];
  source: string;
}

export default function AdminDataImport() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("stops");
  
  const [stopsText, setStopsText] = useState("");
  const [studentsText, setStudentsText] = useState("");
  const [region, setRegion] = useState("");
  
  const [stopsPreview, setStopsPreview] = useState<Stop[] | null>(null);
  const [studentsPreview, setStudentsPreview] = useState<Student[] | null>(null);
  
  const [stopsErrors, setStopsErrors] = useState<string[]>([]);
  const [studentsErrors, setStudentsErrors] = useState<string[]>([]);
  
  const [stopsWarnings, setStopsWarnings] = useState<string[]>([]);
  const [studentsWarnings, setStudentsWarnings] = useState<string[]>([]);
  
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitType, setCommitType] = useState<"stops" | "students">("stops");

  const previewStopsMutation = useMutation({
    mutationFn: async ({ text, region }: { text: string; region: string }) => {
      return await apiRequest("POST", "/api/admin/import/stops/preview", { text, region }) as unknown as StopsPreviewResponse;
    },
    onSuccess: (data) => {
      if (!data.success || (data.errors && data.errors.length > 0)) {
        setStopsErrors(data.errors || []);
        setStopsPreview([]);
        toast({
          title: "Parse Errors",
          description: `Found ${data.errors?.length || 0} error(s). Please fix them before importing.`,
          variant: "destructive",
        });
        return;
      }
      
      setStopsPreview(data.stops || []);
      setStopsErrors([]);
      
      toast({
        title: "Preview Generated",
        description: `Found ${data.stops?.length || 0} stop(s) to import.`,
      });
    },
    onError: (error: any) => {
      const errors = error.errors || [error.message || "Failed to parse stops data"];
      setStopsErrors(errors);
      setStopsPreview([]);
      
      toast({
        title: "Preview Failed",
        description: `Found ${errors.length} error(s). Please fix them before importing.`,
        variant: "destructive",
      });
    },
  });

  const previewStudentsMutation = useMutation({
    mutationFn: async (text: string) => {
      return await apiRequest("POST", "/api/admin/import/students/preview", { text }) as unknown as StudentsPreviewResponse;
    },
    onSuccess: (data) => {
      if (!data.success || (data.errors && data.errors.length > 0)) {
        setStudentsErrors(data.errors || []);
        setStudentsPreview([]);
        toast({
          title: "Parse Errors",
          description: `Found ${data.errors?.length || 0} error(s). Please fix them before importing.`,
          variant: "destructive",
        });
        return;
      }
      
      setStudentsPreview(data.students || []);
      setStudentsErrors([]);
      
      toast({
        title: "Preview Generated",
        description: `Found ${data.students?.length || 0} student(s) to import.`,
      });
    },
    onError: (error: any) => {
      const errors = error.errors || [error.message || "Failed to parse students data"];
      setStudentsErrors(errors);
      setStudentsPreview([]);
      
      toast({
        title: "Preview Failed",
        description: `Found ${errors.length} error(s). Please fix them before importing.`,
        variant: "destructive",
      });
    },
  });

  const commitStopsMutation = useMutation({
    mutationFn: async ({ text, region }: { text: string; region: string }) => {
      return await apiRequest("POST", "/api/admin/import/stops/commit", { text, region }) as unknown as StopsCommitResponse;
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast({
          title: "Import Failed",
          description: "Failed to import stops.",
          variant: "destructive",
        });
        setShowCommitDialog(false);
        return;
      }
      
      const created = data.created.length;
      const skipped = data.skipped.length;
      
      setStopsWarnings(data.warnings);
      
      toast({
        title: "Import Successful",
        description: `Created ${created} stop(s). ${skipped > 0 ? `Skipped ${skipped} duplicate(s).` : ''}`,
      });
      
      setStopsText("");
      setStopsPreview([]);
      setStopsErrors([]);
      setShowCommitDialog(false);
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stops"] });
    },
    onError: (error: any) => {
      const errors = error.errors || [error.message || "Failed to import stops"];
      setStopsErrors(errors);
      
      toast({
        title: "Import Failed",
        description: `Failed to import: ${errors.length} error(s)`,
        variant: "destructive",
      });
      setShowCommitDialog(false);
    },
  });

  const commitStudentsMutation = useMutation({
    mutationFn: async (text: string) => {
      return await apiRequest("POST", "/api/admin/import/students/commit", { text }) as unknown as StudentsCommitResponse;
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast({
          title: "Import Failed",
          description: "Failed to import students.",
          variant: "destructive",
        });
        setShowCommitDialog(false);
        return;
      }
      
      const created = data.created.length;
      const skipped = data.skipped.length;
      
      setStudentsWarnings(data.warnings);
      
      toast({
        title: "Import Successful",
        description: `Created ${created} student(s). ${skipped > 0 ? `Skipped ${skipped} duplicate(s).` : ''}`,
      });
      
      setStudentsText("");
      setStudentsPreview([]);
      setStudentsErrors([]);
      setShowCommitDialog(false);
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
    },
    onError: (error: any) => {
      const errors = error.errors || [error.message || "Failed to import students"];
      setStudentsErrors(errors);
      
      toast({
        title: "Import Failed",
        description: `Failed to import: ${errors.length} error(s)`,
        variant: "destructive",
      });
      setShowCommitDialog(false);
    },
  });

  const handlePreviewStops = () => {
    if (!stopsText.trim()) {
      toast({
        title: "No Data",
        description: "Please paste stops data to preview.",
        variant: "destructive",
      });
      return;
    }
    if (!region.trim()) {
      toast({
        title: "Region Required",
        description: "Please enter a region for these stops.",
        variant: "destructive",
      });
      return;
    }
    previewStopsMutation.mutate({ text: stopsText, region });
  };

  const handlePreviewStudents = () => {
    if (!studentsText.trim()) {
      toast({
        title: "No Data",
        description: "Please paste students data to preview.",
        variant: "destructive",
      });
      return;
    }
    previewStudentsMutation.mutate(studentsText);
  };

  const handleCommitStops = () => {
    if (!stopsPreview || stopsPreview.length === 0) {
      toast({
        title: "No Preview",
        description: "Please preview stops before importing.",
        variant: "destructive",
      });
      return;
    }
    if (stopsErrors.length > 0) {
      toast({
        title: "Fix Errors First",
        description: "Please fix all errors before importing.",
        variant: "destructive",
      });
      return;
    }
    setCommitType("stops");
    setShowCommitDialog(true);
  };

  const handleCommitStudents = () => {
    if (!studentsPreview || studentsPreview.length === 0) {
      toast({
        title: "No Preview",
        description: "Please preview students before importing.",
        variant: "destructive",
      });
      return;
    }
    if (studentsErrors.length > 0) {
      toast({
        title: "Fix Errors First",
        description: "Please fix all errors before importing.",
        variant: "destructive",
      });
      return;
    }
    setCommitType("students");
    setShowCommitDialog(true);
  };

  const confirmCommit = () => {
    if (commitType === "stops") {
      commitStopsMutation.mutate({ text: stopsText, region });
    } else {
      commitStudentsMutation.mutate(studentsText);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Data Import</h1>
        <p className="text-muted-foreground">
          Import stops and students from text format
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stops" data-testid="tab-stops">
            <MapPin className="w-4 h-4 mr-2" />
            Stops
          </TabsTrigger>
          <TabsTrigger value="students" data-testid="tab-students">
            <Users className="w-4 h-4 mr-2" />
            Students
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stops" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Stops</CardTitle>
              <CardDescription>
                Paste stop data with format: Name | Address | Latitude,Longitude (one per line)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Region</label>
                <Input
                  placeholder="e.g., North, South, East, West"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  data-testid="input-region"
                />
                <p className="text-xs text-muted-foreground">
                  Region helps organize stops and prevents duplicates across different areas
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Paste Stops Data</label>
                <Textarea
                  placeholder="Example:
Oak Street Stop | 123 Oak St, Springfield | 42.1234,-71.5678
Main Library | 456 Main Ave, Springfield | 42.2345,-71.6789"
                  value={stopsText}
                  onChange={(e) => setStopsText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="textarea-stops-input"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handlePreviewStops}
                  disabled={previewStopsMutation.isPending || !stopsText.trim()}
                  data-testid="button-preview-stops"
                >
                  {previewStopsMutation.isPending ? "Parsing..." : "Preview Import"}
                </Button>
                
                {stopsPreview && stopsPreview.length > 0 && (
                  <Button
                    onClick={handleCommitStops}
                    disabled={commitStopsMutation.isPending}
                    variant="default"
                    data-testid="button-commit-stops"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {commitStopsMutation.isPending ? "Importing..." : `Import ${stopsPreview.length} Stop(s)`}
                  </Button>
                )}
              </div>

              {stopsErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4">
                  <div className="flex gap-2 items-start">
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">Parsing Errors</p>
                      <ul className="text-sm text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
                        {stopsErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {stopsWarnings.length > 0 && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 p-4">
                  <div className="flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Warnings</p>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-400 list-disc list-inside space-y-1">
                        {stopsWarnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {stopsPreview && stopsPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <h3 className="font-semibold">Preview: {stopsPreview.length} Stop(s)</h3>
                  </div>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Coordinates</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stopsPreview.map((stop, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{stop.name}</TableCell>
                            <TableCell>{stop.address}</TableCell>
                            <TableCell>
                              {stop.latitude && stop.longitude ? (
                                <Badge variant="secondary">
                                  {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                                </Badge>
                              ) : (
                                <Badge variant="outline">No coordinates</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Students</CardTitle>
              <CardDescription>
                Paste student data with format: FirstName | LastName | GuardianPhone | GuardianName (one per line)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Paste Students Data</label>
                <Textarea
                  placeholder="Example:
John | Doe | 555-123-4567 | Jane Doe
Emma | Smith | 555-234-5678 | Robert Smith
Oliver | Johnson | 555-111-2222; 555-333-4444 | Mom Name; Dad Name
Sophia | Brown | | "
                  value={studentsText}
                  onChange={(e) => setStudentsText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="textarea-students-input"
                />
                <p className="text-xs text-muted-foreground">
                  Note: Use semicolons (;) to separate multiple guardian phones or names. Students without guardian phone numbers will be created with placeholder households.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handlePreviewStudents}
                  disabled={previewStudentsMutation.isPending || !studentsText.trim()}
                  data-testid="button-preview-students"
                >
                  {previewStudentsMutation.isPending ? "Parsing..." : "Preview Import"}
                </Button>
                
                {studentsPreview && studentsPreview.length > 0 && (
                  <Button
                    onClick={handleCommitStudents}
                    disabled={commitStudentsMutation.isPending}
                    variant="default"
                    data-testid="button-commit-students"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {commitStudentsMutation.isPending ? "Importing..." : `Import ${studentsPreview.length} Student(s)`}
                  </Button>
                )}
              </div>

              {studentsErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4">
                  <div className="flex gap-2 items-start">
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">Parsing Errors</p>
                      <ul className="text-sm text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
                        {studentsErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {studentsWarnings.length > 0 && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 p-4">
                  <div className="flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Warnings</p>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-400 list-disc list-inside space-y-1">
                        {studentsWarnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {studentsPreview && studentsPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <h3 className="font-semibold">Preview: {studentsPreview.length} Student(s)</h3>
                  </div>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Guardian Phone(s)</TableHead>
                          <TableHead>Guardian Name(s)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsPreview.map((student, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {student.firstName} {student.lastName}
                            </TableCell>
                            <TableCell>
                              {student.guardianPhones && student.guardianPhones.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {student.guardianPhones.map((phone, pidx) => (
                                    <Badge key={pidx} variant="secondary">{phone}</Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {student.guardianNames || <span className="text-muted-foreground">N/A</span>}
                            </TableCell>
                            <TableCell>
                              {student.guardianPhones && student.guardianPhones.length > 0 ? (
                                <Badge variant="secondary">Regular</Badge>
                              ) : (
                                <Badge variant="outline">Placeholder</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription>
              {commitType === "stops" ? (
                <>
                  You are about to import <strong>{stopsPreview?.length || 0} stop(s)</strong>.
                  This action will create new records in the database.
                </>
              ) : (
                <>
                  You are about to import <strong>{studentsPreview?.length || 0} student(s)</strong>.
                  This action will create new records in the database.
                  {studentsPreview?.some(s => !s.guardianPhones || s.guardianPhones.length === 0) && (
                    <div className="mt-2 text-yellow-600 dark:text-yellow-400">
                      Some students will be created with placeholder households (no guardian phone).
                    </div>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-commit">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCommit} data-testid="button-confirm-commit">
              Import Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
