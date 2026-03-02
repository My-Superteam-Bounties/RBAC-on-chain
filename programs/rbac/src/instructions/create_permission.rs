use anchor_lang::prelude::*;

use crate::errors::RbacError;
use crate::events::PermissionCreated;
use crate::state::*;

#[derive(Accounts)]
#[instruction(name: String, resource: String, action: String)]
pub struct CreatePermission<'info> {
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
        space = PERMISSION_SIZE,
        seeds = [PERMISSION_SEED, name.as_bytes()],
        bump,
    )]
    pub permission: Account<'info, Permission>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreatePermission>, name: String, resource: String, action: String) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, RbacError::NameTooLong);
    require!(resource.len() <= MAX_NAME_LEN, RbacError::ResourceTooLong);
    require!(action.len() <= MAX_NAME_LEN, RbacError::ActionTooLong);

    let permission = &mut ctx.accounts.permission;
    permission.name = name.clone();
    permission.resource = resource.clone();
    permission.action = action.clone();
    permission.created_at = Clock::get()?.unix_timestamp;
    permission.bump = ctx.bumps.permission;

    let state = &mut ctx.accounts.rbac_state;
    state.total_permissions += 1;

    emit!(PermissionCreated {
        permission: ctx.accounts.permission.key(),
        name,
        resource,
        action,
        authority: ctx.accounts.authority.key(),
    });

    Ok(())
}
