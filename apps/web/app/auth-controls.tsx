"use client";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";

const enabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("replace_me"));

export function AuthControls() {
  if (!enabled) return <span className="auth-demo">Demo mode</span>;
  return <div className="auth-controls"><SignedOut><Link className="btn ghost" href="/sign-in">Sign in</Link><Link className="btn" href="/sign-up">Create account</Link></SignedOut><SignedIn><UserButton /></SignedIn></div>;
}
