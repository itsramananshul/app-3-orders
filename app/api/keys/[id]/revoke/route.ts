import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";
import { getInstanceName } from "@/lib/supabase";

const APP_TYPE = "orders";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await revokeApiKey(params.id, APP_TYPE, getInstanceName());
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
