import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// A signed cookie whose user no longer exists (or no longer passes the DAL check)
// lands here: clear it and go to /login, instead of bouncing between the proxy
// (which trusts the signature) and the pages (which check the database).
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
