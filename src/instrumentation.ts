/** Server boot diagnostics (visible in Railway logs). No secrets logged. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const url = process.env.DATABASE_URL ?? "";
  const dbHint =
    url.length === 0
      ? "MISSING"
      : url.includes("railway.internal")
        ? "postgresql (private railway)"
        : "postgresql (non-private or public)";

  console.log("[tranquil/boot] DATABASE_URL:", dbHint);
  console.log(
    "[tranquil/boot] Clerk:",
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      ? "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=yes"
      : "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=MISSING",
    "|",
    process.env.CLERK_SECRET_KEY ? "CLERK_SECRET_KEY=yes" : "CLERK_SECRET_KEY=MISSING",
  );
}
