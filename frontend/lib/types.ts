export type RoleName = "student" | "staff" | "admin";

export type RoleRead = {
  id: number;
  name: RoleName;
};

export type UserRead = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  matric_number?: string | null;
  phone_number?: string | null;
  faculty?: string | null;
  department?: string | null;
  level?: string | null;
  is_active: boolean;
  created_at: string;
  roles: RoleRead[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  first_name: string;
  last_name: string;
  matric_number: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
};

export type UserProfileUpdateRequest = {
  first_name?: string;
  last_name?: string;
  matric_number?: string;
  phone_number?: string;
  faculty?: string;
  department?: string;
  level?: string;
};

export type RoleAssignmentRequest = {
  role_name: RoleName;
};

export type AdminUserCreateRequest = {
  email: string;
  password: string;
  role_name: RoleName;
  first_name?: string;
  last_name?: string;
  matric_number?: string;
  phone_number?: string;
  faculty?: string;
  department?: string;
  level?: string;
};

export type AdminUserUpdateRequest = {
  email: string;
  role_name: RoleName;
  password?: string;
  first_name?: string | null;
  last_name?: string | null;
  matric_number?: string | null;
  phone_number?: string | null;
  faculty?: string | null;
  department?: string | null;
  level?: string | null;
  is_active: boolean;
};

export type GrievanceStatus = "open" | "in_progress" | "resolved" | "closed";

export type GrievanceUserSummary = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

export type GrievanceDepartmentSummary = {
  id: number;
  name: string;
  code: string;
};

export type GrievanceCommentRead = {
  id: string;
  grievance_id: string;
  user_id?: string | null;
  body: string;
  created_at: string;
  user?: GrievanceUserSummary | null;
};

export type GrievanceStatusHistoryRead = {
  id: string;
  grievance_id: string;
  changed_by_user_id?: string | null;
  from_status?: GrievanceStatus | null;
  to_status: GrievanceStatus;
  note?: string | null;
  created_at: string;
  changed_by_user?: GrievanceUserSummary | null;
};

export type GrievanceListItem = {
  id: string;
  student_id: string;
  title: string;
  category: string;
  status: GrievanceStatus;
  is_anonymous: boolean;
  assigned_to_user_id?: string | null;
  department_id?: number | null;
  created_at: string;
  updated_at: string;
  first_response_at?: string | null;
  resolved_at?: string | null;
  student: GrievanceUserSummary;
  assigned_to_user?: GrievanceUserSummary | null;
  department?: GrievanceDepartmentSummary | null;
};

export type GrievanceRead = GrievanceListItem & {
  description: string;
  resolution_note?: string | null;
  comments: GrievanceCommentRead[];
  status_history: GrievanceStatusHistoryRead[];
};

export type GrievanceCreateRequest = {
  title: string;
  description: string;
  category: string;
  is_anonymous?: boolean;
};

export type GrievanceCommentCreateRequest = {
  body: string;
};

export type GrievanceStatusUpdateRequest = {
  status: GrievanceStatus;
  resolution_note?: string;
};

export type GrievanceAssignRequest = {
  assignee_user_id: string;
};

export type DepartmentRead = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DepartmentCreateRequest = {
  name: string;
  code: string;
};

export type DepartmentUpdateRequest = {
  name?: string;
  code?: string;
  is_active?: boolean;
};

export type RouteGrievanceRequest = {
  department_id: number;
  assignee_user_id?: string;
  note?: string;
};

export type GrievanceAssignmentRead = {
  id: string;
  grievance_id: string;
  department_id?: number | null;
  assigned_to_user_id?: string | null;
  assigned_by_user_id?: string | null;
  note?: string | null;
  created_at: string;
  department?: {
    id: number;
    name: string;
    code: string;
  } | null;
  assigned_to_user?: GrievanceUserSummary | null;
  assigned_by_user?: GrievanceUserSummary | null;
};

export type OperationalGrievanceItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  department?: {
    id: number;
    name: string;
    code: string;
  } | null;
  student: GrievanceUserSummary;
  assigned_to_user?: GrievanceUserSummary | null;
  first_response_due_at?: string | null;
  first_response_status?: string | null;
  resolution_due_at?: string | null;
  resolution_status?: string | null;
  escalation_count: number;
  has_active_breach: boolean;
};

export type SLAPolicyRead = {
  id: number;
  department_id: number;
  first_response_minutes: number;
  resolution_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: {
    id: number;
    name: string;
    code: string;
  } | null;
};

export type SLAPolicyUpsertRequest = {
  first_response_minutes: number;
  resolution_minutes: number;
  is_active: boolean;
};

export type EscalationRuleRead = {
  id: number;
  department_id?: number | null;
  breach_type: "first_response" | "resolution";
  severity: "warning" | "critical";
  threshold_minutes: number;
  target_role: "staff" | "admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: {
    id: number;
    name: string;
    code: string;
  } | null;
};

export type EscalationRuleCreateRequest = {
  department_id?: number;
  breach_type: "first_response" | "resolution";
  severity: "warning" | "critical";
  threshold_minutes: number;
  target_role: "staff" | "admin";
  is_active: boolean;
};

export type SLABreachSummary = {
  event_id: string;
  grievance_id: string;
  grievance_title: string;
  grievance_status: string;
  department_id?: number | null;
  breach_type: "first_response" | "resolution";
  due_at: string;
  occurred_at?: string | null;
  breach_minutes: number;
  escalation_count: number;
  student: GrievanceUserSummary;
  assigned_to_user?: GrievanceUserSummary | null;
  department?: {
    id: number;
    name: string;
    code: string;
  } | null;
};

export type SLAEvaluationResponse = {
  evaluated_at: string;
  new_breaches: number;
  new_escalations: number;
};

export type GrievanceCSVImportError = {
  row_number: number;
  message: string;
};

export type GrievanceCSVImportResponse = {
  total_rows: number;
  imported_count: number;
  failed_count: number;
  errors: GrievanceCSVImportError[];
};

export type VolumeTrendPoint = {
  date: string;
  total: number;
};

export type CategoryDistributionPoint = {
  category: string;
  count: number;
  share_percent: number;
};

export type DepartmentHotspotPoint = {
  department_id?: number | null;
  department_name: string;
  grievance_count: number;
  breach_count: number;
  avg_resolution_hours?: number | null;
};

export type FacultyHotspotPoint = {
  faculty: string;
  grievance_count: number;
};

export type BacklogMetrics = {
  open_count: number;
  in_progress_count: number;
  resolved_count: number;
  closed_count: number;
  total_backlog: number;
  overdue_backlog: number;
};

export type ResolutionMetrics = {
  resolved_count: number;
  avg_resolution_hours?: number | null;
  median_resolution_hours?: number | null;
  p90_resolution_hours?: number | null;
};

export type SLACompliancePoint = {
  breach_type: "first_response" | "resolution";
  met_count: number;
  breached_count: number;
  compliance_rate_percent: number;
};

export type TopicClusterInsight = {
  cluster_id: number;
  size: number;
  top_keywords: string[];
  member_ids: string[];
  sample_titles: string[];
};

export type AnalyticsOverviewResponse = {
  generated_at: string;
  period_days: number;
  total_grievances: number;
  volume_trend: VolumeTrendPoint[];
  category_distribution: CategoryDistributionPoint[];
  department_hotspots: DepartmentHotspotPoint[];
  faculty_hotspots: FacultyHotspotPoint[];
  backlog: BacklogMetrics;
  resolution: ResolutionMetrics;
  sla_compliance: SLACompliancePoint[];
  escalation_events: number;
  active_breaches: number;
};

export type AnalyticsTopicClustersResponse = {
  generated_at: string;
  period_days: number;
  clusters: TopicClusterInsight[];
};

export type NLPProviderStatus = {
  provider: string;
  llm_enabled: boolean;
  model?: string | null;
};

export type NLPCategoryScore = {
  label: string;
  score: number;
};

export type NLPSentimentResult = {
  label: string;
  score: number;
  positive_hits: number;
  negative_hits: number;
};

export type NLPUrgencyResult = {
  label: string;
  score: number;
  reasons: string[];
};

export type NLPTextAnalysisRequest = {
  text: string;
  include_llm_enrichment?: boolean;
};

export type NLPTextAnalysisResponse = {
  provider: string;
  predicted_category: string;
  category_confidence: number;
  category_suggestions: NLPCategoryScore[];
  sentiment: NLPSentimentResult;
  urgency: NLPUrgencyResult;
  summary: string;
  entities: Record<string, unknown>;
};

export type NLPGrievanceAnalysisResponse = NLPTextAnalysisResponse & {
  grievance_id: string;
  source_category: string;
};
