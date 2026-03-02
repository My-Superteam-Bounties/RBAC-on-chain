use anchor_lang::prelude::*;

#[error_code]
pub enum RbacError {
    #[msg("Only the super admin can perform this action")]
    Unauthorized,

    #[msg("Name exceeds the maximum allowed length of 32 characters")]
    NameTooLong,

    #[msg("Resource name exceeds the maximum allowed length of 32 characters")]
    ResourceTooLong,

    #[msg("Action name exceeds the maximum allowed length of 32 characters")]
    ActionTooLong,

    #[msg("Access denied: user does not have the required permission")]
    AccessDenied,

    #[msg("The RBAC system has already been initialized")]
    AlreadyInitialized,
}
