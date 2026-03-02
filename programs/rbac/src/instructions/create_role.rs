use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::RoleCreated;
use crate::state::*;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateRole<'info> {
    #[account(
        mut,
        seeds = [RBAC_STATE_SEED],
        bump,
        constraint = rbac_state.super_admin == authority.key() @ RbacError::Unauthorized,
    )]
    pub rbac_state: Account<'info, RbacState>,

    #[account(
        init,
        payer = authority,
        space = ROLE_SIZE,
        seeds = [ROLE_SEED, name.as_bytes()],
        bump,
    )]
    pub role: Account<'info, Role>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateRole>, name: String) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, RbacError::NameTooLong);

    let role = &mut ctx.accounts.role;
    role.name = name.clone();
    role.created_at = Clock::get()?.unix_timestamp;
    role.bump = ctx.bumps.role;

    let state = &mut ctx.accounts.rbac_state;
    state.total_roles += 1;

    emit!(RoleCreated {
        role: ctx.accounts.role.key(),
        name,
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}
