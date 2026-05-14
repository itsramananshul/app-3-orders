import { authenticate } from "@/lib/authenticate";
import {
  errorResponse,
  optionsResponse,
  parsePriority,
  readJsonBody,
  runMutation,
} from "@/lib/api-helpers";
import { updatePriority } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const authError = await authenticate(request);
  if (authError) return authError;
  const body = await readJsonBody(request);
  if (body === null) return errorResponse(400, "Invalid JSON body");
  const parsed = parsePriority(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.message);
  return runMutation(() => updatePriority(params.id, parsed.value));
}

export const OPTIONS = optionsResponse;
