import { auth } from "@clerk/nextjs/server";

export async function requireUser() {
  const authRequired = process.env.AUTH_REQUIRED === "true" || process.env.NODE_ENV === "production";
  if (!authRequired) return "local_demo_user";
  if (!process.env.CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY is required when authentication is enabled.");
  const { userId } = await auth();
  return userId;
}
