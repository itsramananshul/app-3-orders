import { NextResponse } from "next/server";
import {
  clearActiveClientKey,
  getActiveClientKey,
  setActiveClientKey,
} from "@/lib/api-keys";
import { getInstanceName } from "@/lib/supabase";

const APP_TYPE = "orders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rawKey = await getActiveClientKey(APP_TYPE, getInstanceName());
    return NextResponse.json({ rawKey });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { rawKey?: unknown };
    const raw = typeof body.rawKey === "string" ? body.rawKey.trim() : "";
    if (!raw) {
      return NextResponse.json(
        { success: false, error: "rawKey is required" },
        { status: 400 },
      );
    }
    await setActiveClientKey(APP_TYPE, getInstanceName(), raw);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await clearActiveClientKey(APP_TYPE, getInstanceName());
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
