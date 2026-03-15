import { REQUEST_TIMEOUT_MS, apiRequest, getApiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import type {
  DepartmentCreateRequest,
  DepartmentRead,
  DepartmentUpdateRequest,
  EscalationRuleCreateRequest,
  EscalationRuleRead,
  GrievanceAssignmentRead,
  GrievanceCSVImportResponse,
  OperationalGrievanceItem,
  RouteGrievanceRequest,
  SLABreachSummary,
  SLAEvaluationResponse,
  SLAPolicyRead,
  SLAPolicyUpsertRequest,
  UserRead,
} from "@/lib/types";

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
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

export async function listDepartments(activeOnly = false): Promise<DepartmentRead[]> {
  const query = buildQuery({ active_only: activeOnly });
  return apiRequest<DepartmentRead[]>(`/operations/departments${query}`);
}

export async function createDepartment(
  payload: DepartmentCreateRequest,
): Promise<DepartmentRead> {
  return apiRequest<DepartmentRead>("/operations/departments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDepartment(
  departmentId: number,
  payload: DepartmentUpdateRequest,
): Promise<DepartmentRead> {
  return apiRequest<DepartmentRead>(`/operations/departments/${departmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function listSlaPolicies(): Promise<SLAPolicyRead[]> {
  return apiRequest<SLAPolicyRead[]>("/operations/sla/policies");
}

export async function upsertSlaPolicy(
  departmentId: number,
  payload: SLAPolicyUpsertRequest,
): Promise<SLAPolicyRead> {
  return apiRequest<SLAPolicyRead>(`/operations/sla/policies/${departmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function listEscalationRules(): Promise<EscalationRuleRead[]> {
  return apiRequest<EscalationRuleRead[]>("/operations/escalation-rules");
}

export async function createEscalationRule(
  payload: EscalationRuleCreateRequest,
): Promise<EscalationRuleRead> {
  return apiRequest<EscalationRuleRead>("/operations/escalation-rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listOperationsQueue(options?: {
  departmentId?: number;
  includeClosed?: boolean;
}): Promise<OperationalGrievanceItem[]> {
  const query = buildQuery({
    department_id: options?.departmentId,
    include_closed: options?.includeClosed,
  });
  return apiRequest<OperationalGrievanceItem[]>(`/operations/queue${query}`);
}

export async function listAssignableOperationalUsers(
  departmentId?: number,
): Promise<UserRead[]> {
  const query = buildQuery({
    department_id: departmentId,
  });
  return apiRequest<UserRead[]>(`/operations/assignable-users${query}`);
}

export async function routeGrievance(
  grievanceId: string,
  payload: RouteGrievanceRequest,
) {
  return apiRequest(`/operations/grievances/${grievanceId}/route`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listGrievanceAssignments(
  grievanceId: string,
): Promise<GrievanceAssignmentRead[]> {
  return apiRequest<GrievanceAssignmentRead[]>(
    `/operations/grievances/${grievanceId}/assignments`,
  );
}

export async function evaluateSla(): Promise<SLAEvaluationResponse> {
  return apiRequest<SLAEvaluationResponse>("/operations/sla/evaluate", {
    method: "POST",
  });
}

export async function listSlaBreaches(): Promise<SLABreachSummary[]> {
  return apiRequest<SLABreachSummary[]>("/operations/sla/breaches");
}

export async function importGrievancesCsv(
  file: File,
): Promise<GrievanceCSVImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/operations/imports/grievances/csv`, {
      method: "POST",
      body: formData,
      credentials: "include",
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("CSV import request timed out.");
    }
    throw new Error("Unable to reach backend for CSV import.");
  } finally {
    clearTimeout(timeoutHandle);
  }

  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const detail = payload?.detail ?? "CSV import failed";
    throw new Error(detail);
  }

  return payload as GrievanceCSVImportResponse;
}
