// src/middleware.ts
import { authMiddleware, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const publicRoutes = ["/", "/api/webhooks/register", "/sign-in", "/sign-up"];

const roleDashboardMap: Record<string, string> = {
  admin: "/admin/dashboard",
  vendor: "/vendor/dashboard",
  customer: "/dashboard",
};

export default authMiddleware({
  publicRoutes,
  async afterAuth(auth, req) {
    // Handle unauthenticated users
    if (!auth.userId && !publicRoutes.includes(req.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // Process authenticated users
    if (auth.userId) {
      try {
        const user = await clerkClient.users.getUser(auth.userId);
        const role = (user.publicMetadata.role as string) || "customer";
        const dashboardPath = roleDashboardMap[role];

        // Redirect from public routes to appropriate dashboard
        if (publicRoutes.includes(req.nextUrl.pathname)) {
          return NextResponse.redirect(new URL(dashboardPath, req.url));
        }

        // Normalize generic dashboard path
        if (req.nextUrl.pathname === "/dashboard") {
          return NextResponse.redirect(new URL(dashboardPath, req.url));
        }

        // Admin route protection
        if (req.nextUrl.pathname.startsWith("/admin") && role !== "admin") {
          return NextResponse.redirect(new URL(dashboardPath, req.url));
        }

        // Vendor route protection
        if (req.nextUrl.pathname.startsWith("/vendor") && role !== "vendor") {
          return NextResponse.redirect(new URL(dashboardPath, req.url));
        }

      } catch (error) {
        console.error("Error fetching user data:", error);
        return NextResponse.redirect(new URL("/error", req.url));
      }
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};