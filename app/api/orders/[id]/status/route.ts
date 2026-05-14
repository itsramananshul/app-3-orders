import {
  errorResponse,
  parseStatus,
  readJsonBody,
  runMutation,
} from "@/lib/api-helpers";
import { updateStatus } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = await readJsonBody(request);
  if (body === null) return errorResponse(400, "Invalid JSON body");
  const parsed = parseStatus(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.message);
  return runMutation(() => updateStatus(params.id, parsed.value));
}
