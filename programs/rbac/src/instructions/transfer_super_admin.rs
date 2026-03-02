use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::SuperAdminTransferred;
use crate::state::*;

#[derive(Accounts)]
pub struct TransferSuperAdmin<'info> {
    #[account(
        mut,
        seeds = [RBAC_STATE_SEED],
        bump,
        constraint = rbac_state.super_admin == authority.key() @ RbacError::Unauthorized,
    )]
    pub rbac_state: Account<'info, RbacState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: The new super admin. Does not need to sign — the current admin
    /// unilaterally transfers ownership.
    pub new_admin: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<TransferSuperAdmin>) -> Result<()> {
    let old_admin = ctx.accounts.rbac_state.super_admin;
    let new_admin = ctx.accounts.new_admin.key();

    ctx.accounts.rbac_state.super_admin = new_admin;

    emit!(SuperAdminTransferred {
        old_admin,
        new_admin,
    });

    msg!("Super admin transferred from {} to {}", old_admin, new_admin);
    Ok(())
}
