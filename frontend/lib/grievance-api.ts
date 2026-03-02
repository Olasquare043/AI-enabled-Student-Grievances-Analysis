import { apiRequest } from "@/lib/api";
import type {
  GrievanceAssignRequest,
  GrievanceCommentCreateRequest,
  GrievanceCommentRead,
  GrievanceCreateRequest,
  GrievanceListItem,
  GrievanceRead,
  GrievanceStatus,
  GrievanceStatusUpdateRequest,
} from "@/lib/types";

function buildQuery(params: Record<string, string | boolean | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function createGrievance(
  payload: GrievanceCreateRequest,
): Promise<GrievanceRead> {
  return apiRequest<GrievanceRead>("/grievances", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listGrievances(options?: {
  status?: GrievanceStatus;
  category?: string;
  mine?: boolean;
}): Promise<GrievanceListItem[]> {
  const query = buildQuery({
    status: options?.status,
    category: options?.category,
    mine: options?.mine,
  });
  return apiRequest<GrievanceListItem[]>(`/grievances${query}`);
}

export async function listTriageQueue(options?: {
  status?: GrievanceStatus;
  category?: string;
}): Promise<GrievanceListItem[]> {
  const query = buildQuery({
    status: options?.status,
    category: options?.category,
  });
  return apiRequest<GrievanceListItem[]>(`/grievances/queue${query}`);
}

export async function getGrievanceById(grievanceId: string): Promise<GrievanceRead> {
  return apiRequest<GrievanceRead>(`/grievances/${grievanceId}`);
}

export async function addGrievanceComment(
  grievanceId: string,
  payload: GrievanceCommentCreateRequest,
): Promise<GrievanceCommentRead> {
  return apiRequest<GrievanceCommentRead>(`/grievances/${grievanceId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listGrievanceComments(
  grievanceId: string,
): Promise<GrievanceCommentRead[]> {
  return apiRequest<GrievanceCommentRead[]>(`/grievances/${grievanceId}/comments`);
}

export async function updateGrievanceStatus(
  grievanceId: string,
  payload: GrievanceStatusUpdateRequest,
): Promise<GrievanceRead> {
  return apiRequest<GrievanceRead>(`/grievances/${grievanceId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function assignGrievance(
  grievanceId: string,
  payload: GrievanceAssignRequest,
): Promise<GrievanceRead> {
  return apiRequest<GrievanceRead>(`/grievances/${grievanceId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
