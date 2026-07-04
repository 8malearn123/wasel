import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "inventory_summary",
  title: "Inventory summary",
  description:
    "Summarize the merchant's inventory: total devices, available devices, accessory SKUs, and low-stock accessories.",
  inputSchema: {} as Record<string, z.ZodTypeAny>,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const [{ data: devices, error: dErr }, { data: accessories, error: aErr }] = await Promise.all([
      sb.from("devices").select("status,cost"),
      sb.from("accessories").select("quantity,min_quantity,cost"),
    ]);

    if (dErr || aErr) {
      return {
        content: [{ type: "text", text: (dErr || aErr)!.message }],
        isError: true,
      };
    }
    const totalDevices = devices?.length ?? 0;
    const availableDevices = (devices ?? []).filter((d: any) => d.status === "available").length;
    const accessorySkus = accessories?.length ?? 0;
    const lowStock = (accessories ?? []).filter(
      (a: any) => Number(a.quantity) <= Number(a.min_quantity ?? 5),
    ).length;
    const inventoryValue =
      (devices ?? [])
        .filter((d: any) => d.status === "available")
        .reduce((s: number, d: any) => s + Number(d.cost || 0), 0) +
      (accessories ?? []).reduce(
        (s: number, a: any) => s + Number(a.cost || 0) * Number(a.quantity || 0),
        0,
      );

    const summary = { totalDevices, availableDevices, accessorySkus, lowStock, inventoryValue };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
