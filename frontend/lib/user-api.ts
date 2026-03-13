import { apiRequest } from "@/lib/api";
import type {
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
  RoleAssignmentRequest,
  UserRead,
} from "@/lib/types";

export async function listUsers(): Promise<UserRead[]> {
  return apiRequest<UserRead[]>("/users");
}

export async function createUser(payload: AdminUserCreateRequest): Promise<UserRead> {
  return apiRequest<UserRead>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  userId: string,
  payload: AdminUserUpdateRequest,
): Promise<UserRead> {
  return apiRequest<UserRead>(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await apiRequest<void>(`/users/${userId}`, {
    method: "DELETE",
  });
}

export async function assignUserRole(
  userId: string,
  payload: RoleAssignmentRequest,
): Promise<UserRead> {
  return apiRequest<UserRead>(`/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
