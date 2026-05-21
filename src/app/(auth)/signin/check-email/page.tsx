import { redirect } from "next/navigation";

/** Legacy magic-link path — Clerk handles verification in-app. */
export default function CheckEmailRedirectPage() {
  redirect("/signin");
}
