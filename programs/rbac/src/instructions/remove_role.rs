use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::RoleRemoved;
use crate::state::*;

#[derive(Accounts)]
pub struct RemoveRole<'info> {
    #[account(
        seeds = [RBAC_STATE_SEED],
        bump,
        constraint = rbac_state.super_admin == authority.key() @ RbacError::Unauthorized,
    )]
    pub rbac_state: Account<'info, RbacState>,

    #[account(
        mut,
        close = authority,
        seeds = [ROLE_SEED, role.name.as_bytes()],
        bump = role.bump,
    )]
    pub role: Account<'info, Role>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RemoveRole>) -> Result<()> {
    emit!(RoleRemoved {
        role: ctx.accounts.role.key(),
        name: ctx.accounts.role.name.clone(),
        authority: ctx.accounts.authority.key(),
    });

    msg!("Role '{}' removed", ctx.accounts.role.name);
    Ok(())
}
