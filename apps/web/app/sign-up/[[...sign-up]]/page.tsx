"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return <main className="auth-page"><Link href="/" className="brand auth-brand">Mur<i>d</i>ock</Link><div className="auth-scribble">let&apos;s make legal easier ✦</div><SignUp fallbackRedirectUrl="/" signInUrl="/sign-in" /><p className="auth-legal">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p></main>;
}
