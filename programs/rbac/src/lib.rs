use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("DKm6aeoBePLZNhYf14TVdQ2d3TUeWcd6nfnP8uruVgs9");

#[program]
pub mod rbac {
    use super::*;

    /// Initialize the RBAC system. Creates the singleton state PDA
    /// and sets the caller as the super admin.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Create a new named role (e.g. "doctor", "nurse").
    /// Only callable by the super admin.
    pub fn create_role(ctx: Context<CreateRole>, name: String) -> Result<()> {
        instructions::create_role::handler(ctx, name)
    }

    /// Create a new named permission (e.g. "read_medical_record").
    /// Only callable by the super admin.
    pub fn create_permission(
        ctx: Context<CreatePermission>,
        name: String,
        resource: String,
        action: String,
    ) -> Result<()> {
        instructions::create_permission::handler(ctx, name, resource, action)
    }

    /// Assign a permission to a role, creating the junction PDA.
    /// Only callable by the super admin.
    pub fn assign_permission_to_role(ctx: Context<AssignPermissionToRole>) -> Result<()> {
        instructions::assign_permission_to_role::handler(ctx)
    }

    /// Revoke a permission from a role by closing the junction PDA.
    /// Only callable by the super admin.
    pub fn revoke_permission_from_role(ctx: Context<RevokePermissionFromRole>) -> Result<()> {
        instructions::revoke_permission_from_role::handler(ctx)
    }

    /// Assign a role to a user, creating the junction PDA.
    /// Only callable by the super admin.
    pub fn assign_role_to_user(ctx: Context<AssignRoleToUser>) -> Result<()> {
        instructions::assign_role_to_user::handler(ctx)
    }

    /// Revoke a role from a user by closing the junction PDA.
    /// Only callable by the super admin.
    pub fn revoke_role_from_user(ctx: Context<RevokeRoleFromUser>) -> Result<()> {
        instructions::revoke_role_from_user::handler(ctx)
    }

    /// Check if a user has a specific permission through any of their roles.
    /// This is a read-only instruction that validates the PDA chain:
    ///   user → UserRole → Role → RolePermission → Permission
    /// If any link is missing, the transaction fails (access denied by construction).
    /// Callable by anyone.
    pub fn check_access(ctx: Context<CheckAccess>) -> Result<()> {
        instructions::check_access::handler(ctx)
    }

    /// Transfer super admin authority to a new public key.
    /// Only callable by the current super admin.
    pub fn transfer_super_admin(ctx: Context<TransferSuperAdmin>) -> Result<()> {
        instructions::transfer_super_admin::handler(ctx)
    }

    /// Remove a role by closing its PDA account.
    /// Only callable by the super admin.
    pub fn remove_role(ctx: Context<RemoveRole>) -> Result<()> {
        instructions::remove_role::handler(ctx)
    }

    /// Remove a permission by closing its PDA account.
    /// Only callable by the super admin.
    pub fn remove_permission(ctx: Context<RemovePermission>) -> Result<()> {
        instructions::remove_permission::handler(ctx)
    }
}
