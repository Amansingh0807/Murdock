import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// The landing, legal pages, and Clerk sign-in/up stay public. User documents and
// dashboard data are private and must always go through Clerk first.
const isProtectedRoute = createRouteMatcher(["/workspace(.*)", "/account(.*)", "/dashboard(.*)", "/documents(.*)"]);
const hasClerkConfig = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) await auth.protect();
});

export default hasClerkConfig
  ? clerkHandler
  : (request: Request) => {
      if (isProtectedRoute(request)) return NextResponse.redirect(new URL("/sign-in?error=auth-config", request.url));
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
