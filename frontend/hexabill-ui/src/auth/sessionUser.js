// Token decoding supplies browser display/storage scope only. The server verifies authority.
export function userFromToken(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(decodeURIComponent(atob(base64).split('')
      .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`).join('')))
    return {
      id: Number(decoded.sub || decoded.UserId || 0),
      role: decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 'Staff',
      name: decoded.name || 'Support session',
      tenantId: decoded.tid ? Number(decoded.tid) : null,
      supportSession: decoded.support_session ? Number(decoded.support_session) : null,
      supportReadOnly: decoded.support_readonly === 'true',
    }
  } catch {
    return null
  }
}

export function mergeValidatedUser(previous, data, token) {
  return {
    ...previous,
    id: data.userId ?? data.UserId ?? previous.id,
    role: data.role ?? data.Role ?? previous.role,
    name: data.name ?? data.Name ?? previous.name,
    tenantId: data.tenantId ?? data.TenantId ?? userFromToken(token)?.tenantId ?? previous.tenantId ?? null,
    dashboardPermissions: data.dashboardPermissions ?? data.DashboardPermissions ?? previous.dashboardPermissions,
    pageAccess: data.pageAccess ?? data.PageAccess ?? previous.pageAccess,
    assignedBranchIds: data.assignedBranchIds ?? data.AssignedBranchIds ?? previous.assignedBranchIds ?? [],
    assignedRouteIds: data.assignedRouteIds ?? data.AssignedRouteIds ?? previous.assignedRouteIds ?? [],
    mustChangePassword: data.mustChangePassword ?? data.MustChangePassword ?? previous.mustChangePassword ?? false,
    supportSession: previous.supportSession ?? null,
    supportReadOnly: previous.supportReadOnly ?? false,
  }
}
