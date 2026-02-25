namespace HexaBill.Api.Models
{
    public class UserDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? DashboardPermissions { get; set; }
        public string? PageAccess { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime? LastActiveAt { get; set; }
        public List<int>? AssignedBranchIds { get; set; }
        public List<int>? AssignedRouteIds { get; set; }
    }
}
