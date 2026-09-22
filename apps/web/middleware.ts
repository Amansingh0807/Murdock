import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// The landing, legal pages, and Clerk sign-in/up stay public. User documents and
// dashboard data are private and must always go through Clerk first.
const isProtectedRoute = createRouteMatcher(["/workspace(.*)", "/account(.*)", "/dashboard(.*)", "/documents(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
