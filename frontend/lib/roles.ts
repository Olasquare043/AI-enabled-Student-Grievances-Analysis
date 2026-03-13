import type { RoleRead } from "@/lib/types";

const rolePriority: Record<string, number> = {
  student: 0,
  staff: 1,
  admin: 2,
};

export function getPrimaryRole(roles: RoleRead[]): RoleRead | null {
  if (roles.length === 0) {
    return null;
  }

  return [...roles].sort(
    (left, right) => (rolePriority[right.name] ?? -1) - (rolePriority[left.name] ?? -1),
  )[0] ?? null;
}
