use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::RbacInitialized;
use crate::state::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = RBAC_STATE_SIZE,
        seeds = [RBAC_STATE_SEED],
        bump,
    )]
    pub rbac_state: Account<'info, RbacState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let state = &mut ctx.accounts.rbac_state;
    state.super_admin = ctx.accounts.authority.key();
    state.total_roles = 0;
    state.total_permissions = 0;

    emit!(RbacInitialized {
        super_admin: ctx.accounts.authority.key(),
    });

    msg!("RBAC system initialized. Super admin: {}", ctx.accounts.authority.key());
    Ok(())
}
