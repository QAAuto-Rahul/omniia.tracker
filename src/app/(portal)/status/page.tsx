import type { Metadata } from "next";
import { StatusBoardView } from "@/components/status/status-board";
import { getStatusBoard } from "@/lib/status/queries";

export const metadata: Metadata = { title: "Service Health" };

export default async function StatusPage() {
  const board = await getStatusBoard();
  return <StatusBoardView board={board} />;
}
