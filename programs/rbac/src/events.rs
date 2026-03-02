use anchor_lang::prelude::*;

#[event]
pub struct RbacInitialized {
    pub super_admin: Pubkey,
}

#[event]
pub struct RoleCreated {
    pub role: Pubkey,
    pub name: String,
    pub authority: Pubkey,
}

#[event]
pub struct RoleRemoved {
    pub role: Pubkey,
    pub name: String,
    pub authority: Pubkey,
}

#[event]
pub struct PermissionCreated {
    pub permission: Pubkey,
    pub name: String,
    pub resource: String,
    pub action: String,
    pub authority: Pubkey,
}

#[event]
pub struct PermissionRemoved {
    pub permission: Pubkey,
    pub name: String,
    pub authority: Pubkey,
}

#[event]
pub struct PermissionAssigned {
    pub role: Pubkey,
    pub permission: Pubkey,
    pub role_name: String,
    pub permission_name: String,
}

#[event]
pub struct PermissionRevoked {
    pub role: Pubkey,
    pub permission: Pubkey,
    pub role_name: String,
    pub permission_name: String,
}

#[event]
pub struct RoleAssigned {
    pub user: Pubkey,
    pub role: Pubkey,
    pub role_name: String,
}

#[event]
pub struct RoleRevoked {
    pub user: Pubkey,
    pub role: Pubkey,
    pub role_name: String,
}

#[event]
pub struct AccessCheckResult {
    pub user: Pubkey,
    pub permission: Pubkey,
    pub permission_name: String,
    pub allowed: bool,
}

#[event]
pub struct SuperAdminTransferred {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}
