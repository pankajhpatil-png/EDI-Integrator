import { redirect } from "next/navigation";

// Test & Preview was folded into the Mapping page itself (as a collapsible
// section) so testing a mapping no longer requires navigating away from it —
// this route stays only so any old link/bookmark still lands somewhere useful.
export default function TestPreviewRedirect() {
  redirect("/map/json-to-edi");
}
