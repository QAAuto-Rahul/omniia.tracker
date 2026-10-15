import type { Metadata } from "next";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { getDocuments } from "@/lib/documents/queries";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const documents = await getDocuments();
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Documents</h1><p className="text-sm text-muted-foreground">Save and preview links to team spreadsheets and documents. Changes are recorded in the Audit Log.</p></div>
    <DocumentsPanel initialDocuments={documents} />
  </div>;
}
