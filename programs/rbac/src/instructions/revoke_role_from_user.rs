use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::RoleRevoked;
use crate::state::*;

#[derive(Accounts)]
pub struct RevokeRoleFromUser<'info> {
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

    /// CHECK: This is the pubkey of the user whose role is being revoked.
    pub user: UncheckedAccount<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [USER_ROLE_SEED, user.key().as_ref(), role.key().as_ref()],
        bump = user_role.bump,
        constraint = user_role.user == user.key(),
        constraint = user_role.role == role.key(),
    )]
    pub user_role: Account<'info, UserRole>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RevokeRoleFromUser>) -> Result<()> {
    emit!(RoleRevoked {
        user: ctx.accounts.user.key(),
        role: ctx.accounts.role.key(),
        role_name: ctx.accounts.role.name.clone(),
    });

    msg!(
        "Revoked role '{}' from user {}",
        ctx.accounts.role.name,
        ctx.accounts.user.key(),
    );

    Ok(())
}
