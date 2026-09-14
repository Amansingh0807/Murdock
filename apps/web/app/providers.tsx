"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { createContext, useContext } from "react";

type TokenGetter = () => Promise<string | null>;
const TokenContext = createContext<TokenGetter>(async () => null);

function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  return <TokenContext.Provider value={() => getToken()}>{children}</TokenContext.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const appearance = {
    variables: { colorPrimary: "#ff4d4d", colorBackground: "#ffffff", colorText: "#2d2d2d", colorInputBackground: "#fdfbf7", colorInputText: "#2d2d2d", borderRadius: "12px" },
    elements: { cardBox: { boxShadow: "6px 6px 0 #2d2d2d", border: "3px solid #2d2d2d" }, card: { borderRadius: "12px 35px 18px 28px / 30px 15px 35px 18px" }, headerTitle: { fontFamily: "Kalam, cursive", fontWeight: "700" }, formButtonPrimary: { border: "3px solid #2d2d2d", boxShadow: "3px 3px 0 #2d2d2d", fontFamily: "Patrick Hand, cursive" }, formFieldInput: { border: "2px solid #2d2d2d", fontFamily: "Patrick Hand, cursive" } },
  };
  return key && !key.includes("replace_me") ? <ClerkProvider appearance={appearance}><ClerkTokenProvider>{children}</ClerkTokenProvider></ClerkProvider> : <TokenContext.Provider value={async () => null}>{children}</TokenContext.Provider>;
}

export function useApiToken() { return useContext(TokenContext); }
