"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return <main className="auth-page"><Link href="/" className="brand auth-brand">Mur<i>d</i>ock</Link><div className="auth-scribble">welcome back ↓</div><SignIn fallbackRedirectUrl="/" signUpUrl="/sign-up" /><p className="auth-legal">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p></main>;
}
