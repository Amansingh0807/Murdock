"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

const enabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("replace_me"));

export function AuthControls() {
  if (!enabled) return <span className="auth-demo">Demo mode</span>;
  return <div className="auth-controls"><Show when="signed-out"><Link className="btn ghost" href="/sign-in">Sign in</Link><Link className="btn" href="/sign-up">Create account</Link></Show><Show when="signed-in"><UserButton /></Show></div>;
}
