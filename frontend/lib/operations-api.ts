import { apiRequest } from "@/lib/api";
import type {
  DepartmentCreateRequest,
  DepartmentRead,
  DepartmentUpdateRequest,
  EscalationRuleCreateRequest,
  EscalationRuleRead,
  GrievanceAssignmentRead,
  OperationalGrievanceItem,
  RouteGrievanceRequest,
  SLABreachSummary,
  SLAEvaluationResponse,
  SLAPolicyRead,
  SLAPolicyUpsertRequest,
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
