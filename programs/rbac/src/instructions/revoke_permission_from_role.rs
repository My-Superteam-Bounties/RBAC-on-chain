use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::PermissionRevoked;
use crate::state::*;

#[derive(Accounts)]
pub struct RevokePermissionFromRole<'info> {
    #[account(
        seeds = [RBAC_STATE_SEED],
        bump,
        constraint = rbac_state.super_admin == authority.key() @ RbacError::Unauthorized,
    )]
    pub rbac_state: Account<'info, RbacState>,

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

    #[account(
        mut,
        close = authority,
        seeds = [ROLE_PERMISSION_SEED, role.key().as_ref(), permission.key().as_ref()],
        bump = role_permission.bump,
        constraint = role_permission.role == role.key(),
        constraint = role_permission.permission == permission.key(),
    )]
    pub role_permission: Account<'info, RolePermission>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RevokePermissionFromRole>) -> Result<()> {
    emit!(PermissionRevoked {
        role: ctx.accounts.role.key(),
        permission: ctx.accounts.permission.key(),
        role_name: ctx.accounts.role.name.clone(),
        permission_name: ctx.accounts.permission.name.clone(),
    });

    msg!(
        "Revoked permission '{}' from role '{}'",
        ctx.accounts.permission.name,
        ctx.accounts.role.name,
    );

    Ok(())
}
