import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRecentSales from "./tools/list-recent-sales";
import inventorySummary from "./tools/inventory-summary";
import listActiveRepairs from "./tools/list-active-repairs";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "wasil-os-mcp",
  title: "Wasil OS",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in Wasil OS merchant: read recent POS sales, inventory summary, and active repair orders. All data is scoped to the merchant via RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRecentSales, inventorySummary, listActiveRepairs],
});
