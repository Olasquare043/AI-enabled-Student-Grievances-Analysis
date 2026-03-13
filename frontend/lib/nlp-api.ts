import { apiRequest } from "@/lib/api";
import type {
  NLPGrievanceAnalysisResponse,
  NLPProviderStatus,
  NLPTextAnalysisRequest,
  NLPTextAnalysisResponse,
} from "@/lib/types";

export async function getNlpProviderStatus(): Promise<NLPProviderStatus> {
  return apiRequest<NLPProviderStatus>("/nlp/provider");
}

export async function analyzeNlpText(
  payload: NLPTextAnalysisRequest,
): Promise<NLPTextAnalysisResponse> {
  return apiRequest<NLPTextAnalysisResponse>("/nlp/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function analyzeGrievance(
  grievanceId: string,
  includeLlmEnrichment = true,
): Promise<NLPGrievanceAnalysisResponse> {
  return apiRequest<NLPGrievanceAnalysisResponse>(`/nlp/grievances/${grievanceId}/analyze`, {
    method: "POST",
    body: JSON.stringify({ include_llm_enrichment: includeLlmEnrichment }),
  });
}
