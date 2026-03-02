use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::PermissionRemoved;
use crate::state::*;

#[derive(Accounts)]
pub struct RemovePermission<'info> {
    #[account(
        seeds = [RBAC_STATE_SEED],
        bump,
        constraint = rbac_state.super_admin == authority.key() @ RbacError::Unauthorized,
    )]
    pub rbac_state: Account<'info, RbacState>,

    #[account(
        mut,
        close = authority,
        seeds = [PERMISSION_SEED, permission.name.as_bytes()],
        bump = permission.bump,
    )]
    pub permission: Account<'info, Permission>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RemovePermission>) -> Result<()> {
    emit!(PermissionRemoved {
        permission: ctx.accounts.permission.key(),
        name: ctx.accounts.permission.name.clone(),
        authority: ctx.accounts.authority.key(),
    });

    msg!("Permission '{}' removed", ctx.accounts.permission.name);
    Ok(())
}
