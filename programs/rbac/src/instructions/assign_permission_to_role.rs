use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::PermissionAssigned;
use crate::state::*;

#[derive(Accounts)]
pub struct AssignPermissionToRole<'info> {
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
        init,
        payer = authority,
        space = ROLE_PERMISSION_SIZE,
        seeds = [ROLE_PERMISSION_SEED, role.key().as_ref(), permission.key().as_ref()],
        bump,
    )]
    pub role_permission: Account<'info, RolePermission>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AssignPermissionToRole>) -> Result<()> {
    let rp = &mut ctx.accounts.role_permission;
    rp.role = ctx.accounts.role.key();
    rp.permission = ctx.accounts.permission.key();
    rp.assigned_at = Clock::get()?.unix_timestamp;
    rp.bump = ctx.bumps.role_permission;

    emit!(PermissionAssigned {
        role: ctx.accounts.role.key(),
        permission: ctx.accounts.permission.key(),
        role_name: ctx.accounts.role.name.clone(),
        permission_name: ctx.accounts.permission.name.clone(),
    });

    Ok(())
}
