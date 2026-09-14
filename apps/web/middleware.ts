import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// The public landing, legal pages, and Clerk-hosted sign-in/up stay accessible.
// Add future authenticated screens here (for example /workspace or /account).
const isProtectedRoute = createRouteMatcher(["/workspace(.*)", "/account(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
