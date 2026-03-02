use anchor_lang::prelude::*;

/// Maximum length for names (role names, permission names, resources, actions).
pub const MAX_NAME_LEN: usize = 32;

/// Discriminator (8) + pubkey (32) + u64 (8) + u64 (8)
pub const RBAC_STATE_SIZE: usize = 8 + 32 + 8 + 8;

/// Discriminator (8) + string prefix (4) + max_name (32) + i64 (8) + bump (1)
pub const ROLE_SIZE: usize = 8 + 4 + MAX_NAME_LEN + 8 + 1;

/// Discriminator (8) + name string (4 + 32) + resource string (4 + 32) + action string (4 + 32) + i64 (8) + bump (1)
pub const PERMISSION_SIZE: usize = 8 + (4 + MAX_NAME_LEN) + (4 + MAX_NAME_LEN) + (4 + MAX_NAME_LEN) + 8 + 1;

/// Discriminator (8) + user pubkey (32) + role pubkey (32) + i64 (8) + bump (1)
pub const USER_ROLE_SIZE: usize = 8 + 32 + 32 + 8 + 1;

/// Discriminator (8) + role pubkey (32) + permission pubkey (32) + i64 (8) + bump (1)
pub const ROLE_PERMISSION_SIZE: usize = 8 + 32 + 32 + 8 + 1;

// ── Seeds ──────────────────────────────────────────────────────────────

pub const RBAC_STATE_SEED: &[u8] = b"rbac_state";
pub const ROLE_SEED: &[u8] = b"role";
pub const PERMISSION_SEED: &[u8] = b"permission";
pub const USER_ROLE_SEED: &[u8] = b"user_role";
pub const ROLE_PERMISSION_SEED: &[u8] = b"role_permission";

// ── Accounts ───────────────────────────────────────────────────────────

/// Singleton root state for the RBAC system.
/// Stores the super-admin authority and aggregate counters.
#[account]
pub struct RbacState {
    /// The authority who can create/manage roles and permissions.
    pub super_admin: Pubkey,
    /// Total number of roles created (monotonic counter, never decremented).
    pub total_roles: u64,
    /// Total number of permissions created (monotonic counter).
    pub total_permissions: u64,
}

/// A named role in the RBAC system (e.g. "doctor", "nurse").
#[account]
pub struct Role {
    /// Human-readable name, max 32 bytes.
    pub name: String,
    /// Unix timestamp when this role was created.
    pub created_at: i64,
    /// PDA bump.
    pub bump: u8,
}

/// A named permission in the RBAC system (e.g. "read_medical_record").
#[account]
pub struct Permission {
    /// Human-readable permission name.
    pub name: String,
    /// The resource this permission applies to (e.g. "medical_record").
    pub resource: String,
    /// The action allowed (e.g. "read", "write").
    pub action: String,
    /// Unix timestamp when this permission was created.
    pub created_at: i64,
    /// PDA bump.
    pub bump: u8,
}

/// Junction account linking a user → role assignment.
#[account]
pub struct UserRole {
    /// The user's public key.
    pub user: Pubkey,
    /// The role PDA public key.
    pub role: Pubkey,
    /// Unix timestamp when this assignment was made.
    pub assigned_at: i64,
    /// PDA bump.
    pub bump: u8,
}

/// Junction account linking a role → permission assignment.
#[account]
pub struct RolePermission {
    /// The role PDA public key.
    pub role: Pubkey,
    /// The permission PDA public key.
    pub permission: Pubkey,
    /// Unix timestamp when this assignment was made.
    pub assigned_at: i64,
    /// PDA bump.
    pub bump: u8,
}
