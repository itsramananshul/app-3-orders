import { authenticate } from "@/lib/authenticate";
import {
  errorResponse,
  optionsResponse,
  parseNote,
  readJsonBody,
  runMutation,
} from "@/lib/api-helpers";
import { addNote } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const authError = await authenticate(request);
  if (authError) return authError;
  const body = await readJsonBody(request);
  if (body === null) return errorResponse(400, "Invalid JSON body");
  const parsed = parseNote(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.message);
  return runMutation(() => addNote(params.id, parsed.value));
}

export const OPTIONS = optionsResponse;
