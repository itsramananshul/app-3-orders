import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { getInstanceName } from "@/lib/supabase";

const APP_TYPE = "orders";
const KEY_PREFIX = "sk_ord_";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const keys = await listApiKeys(APP_TYPE, getInstanceName());
    return NextResponse.json(keys);
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 },
      );
    }
    const { record, rawKey } = await createApiKey(
      APP_TYPE,
      getInstanceName(),
      KEY_PREFIX,
      name,
    );
    return NextResponse.json({ success: true, record, rawKey }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
