use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::RoleAssigned;
use crate::state::*;

#[derive(Accounts)]
pub struct AssignRoleToUser<'info> {
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

    /// CHECK: This is the pubkey of the user being assigned a role.
    /// It does not need to sign — only the admin assigns roles.
    pub user: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = USER_ROLE_SIZE,
        seeds = [USER_ROLE_SEED, user.key().as_ref(), role.key().as_ref()],
        bump,
    )]
    pub user_role: Account<'info, UserRole>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AssignRoleToUser>) -> Result<()> {
    let ur = &mut ctx.accounts.user_role;
    ur.user = ctx.accounts.user.key();
    ur.role = ctx.accounts.role.key();
    ur.assigned_at = Clock::get()?.unix_timestamp;
    ur.bump = ctx.bumps.user_role;

    emit!(RoleAssigned {
        user: ctx.accounts.user.key(),
        role: ctx.accounts.role.key(),
        role_name: ctx.accounts.role.name.clone(),
    });

    Ok(())
}
