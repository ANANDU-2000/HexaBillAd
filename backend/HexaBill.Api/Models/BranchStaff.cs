/*
 * Many-to-many: Branch <-> User (Staff). Staff assigned to a branch.
 */
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class BranchStaff
    {
        public int Id { get; set; }
        public int BranchId { get; set; }
        public int UserId { get; set; }
        public DateTime AssignedAt { get; set; }

        public virtual Branch Branch { get; set; } = null!;
        public virtual User User { get; set; } = null!;
    }
}
