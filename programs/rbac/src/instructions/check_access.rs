use anchor_lang::prelude::*;

use crate::events::AccessCheckResult;
use crate::state::*;

/// check_access validates that the chain user → role → permission exists.
/// It does this by requiring all three junction accounts to be present and valid.
/// If any account is missing or invalid, the transaction fails.
///
/// This is a read-only instruction — it only emits an event and logs the result.
#[derive(Accounts)]
pub struct CheckAccess<'info> {
    /// CHECK: The user whose access we are checking. Does not need to sign.
    pub user: UncheckedAccount<'info>,

    #[account(
        seeds = [ROLE_SEED, role.name.as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'info, Role>,

    #[account(
        seeds = [PERMISSION_SEED, permission.name.as_bytes()],
        bump = permission.bump,
    )]
    pub permission: Account<'info, Permission>,

    /// The UserRole junction — proves the user has this role.
    #[account(
        seeds = [USER_ROLE_SEED, user.key().as_ref(), role.key().as_ref()],
        bump = user_role.bump,
        constraint = user_role.user == user.key(),
        constraint = user_role.role == role.key(),
    )]
    pub user_role: Account<'info, UserRole>,

    /// The RolePermission junction — proves the role has this permission.
    #[account(
        seeds = [ROLE_PERMISSION_SEED, role.key().as_ref(), permission.key().as_ref()],
        bump = role_permission.bump,
        constraint = role_permission.role == role.key(),
        constraint = role_permission.permission == permission.key(),
    )]
    pub role_permission: Account<'info, RolePermission>,
}

pub fn handler(ctx: Context<CheckAccess>) -> Result<()> {
    // If we reach here, all PDA constraints passed — access is granted.
    emit!(AccessCheckResult {
        user: ctx.accounts.user.key(),
        permission: ctx.accounts.permission.key(),
        permission_name: ctx.accounts.permission.name.clone(),
        allowed: true,
    });

    msg!(
        "Access GRANTED: user {} has permission '{}' via role '{}'",
        ctx.accounts.user.key(),
        ctx.accounts.permission.name,
        ctx.accounts.role.name,
    );

    Ok(())
}
