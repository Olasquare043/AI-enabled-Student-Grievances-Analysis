import { apiRequest } from "@/lib/api";
import type { NLPProviderStatus } from "@/lib/types";

export async function getNlpProviderStatus(): Promise<NLPProviderStatus> {
  return apiRequest<NLPProviderStatus>("/nlp/provider");
}
