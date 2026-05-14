import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { CORS_HEADERS, optionsResponse } from "@/lib/api-helpers";
import { getInstanceName } from "@/lib/supabase";

const APP_TYPE = "orders";
const KEY_PREFIX = "sk_ord_";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const keys = await listApiKeys(APP_TYPE, getInstanceName());
    return NextResponse.json(keys, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: CORS_HEADERS },
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
        { status: 400, headers: CORS_HEADERS },
      );
    }
    const { record, rawKey } = await createApiKey(
      APP_TYPE,
      getInstanceName(),
      KEY_PREFIX,
      name,
    );
    return NextResponse.json(
      { success: true, record, rawKey },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export const OPTIONS = optionsResponse;
