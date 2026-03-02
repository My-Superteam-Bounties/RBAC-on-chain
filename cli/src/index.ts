#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import Table from 'cli-table3';
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    rbacStatePda, rolePda, permissionPda,
    userRolePda, rolePermissionPda,
    explorerUrl, shortKey,
} from './helpers.js';

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const IDL_PATH = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../target/idl/rbac.json'
);

function loadIdl(): any {
    if (!fs.existsSync(IDL_PATH)) {
        console.error(chalk.red(`\n  ✗ IDL not found at ${IDL_PATH}`));
        console.error(chalk.dim('    Run `anchor build` first to generate the IDL.\n'));
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(IDL_PATH, 'utf-8'));
}

function loadWallet(): Keypair {
    const keyPath = process.env.ANCHOR_WALLET
        || path.join(os.homedir(), '.config', 'solana', 'id.json');
    if (!fs.existsSync(keyPath)) {
        console.error(chalk.red(`\n  ✗ Wallet not found at ${keyPath}`));
        console.error(chalk.dim('    Run `solana-keygen new` or set ANCHOR_WALLET env var.\n'));
        process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function getCluster(): string {
    return process.env.CLUSTER || 'devnet';
}

function getConnection(): Connection {
    const cluster = getCluster();
    const url = cluster === 'localnet'
        ? 'http://localhost:8899'
        : clusterApiUrl(cluster as any);
    return new Connection(url, 'confirmed');
}

function getProgram(): { program: anchor.Program; wallet: Keypair; programId: PublicKey } {
    const idl = loadIdl();
    const wallet = loadWallet();
    const connection = getConnection();
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(wallet),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);
    const program = new anchor.Program(idl as anchor.Idl, provider);
    const programId = new PublicKey(idl.address);
    return { program, wallet, programId };
}

// ────────────────────────────────────────────────────────────────────────────
// UI Helpers
// ────────────────────────────────────────────────────────────────────────────

const BRAND = chalk.hex('#7c3aed');
const SUCCESS = chalk.hex('#22c55e');
const ERROR = chalk.hex('#ef4444');
const DIM = chalk.dim;
const BOLD = chalk.bold;
const MONO = chalk.hex('#a1a1aa');

function banner() {
    console.log(boxen(
        BRAND.bold('RBAC ON-CHAIN ENGINE') + '\n' +
        DIM('Solana Program CLI v1.0.0'),
        {
            padding: { top: 0, bottom: 0, left: 2, right: 2 },
            borderColor: '#7c3aed',
            borderStyle: 'round',
            margin: { top: 1, bottom: 0, left: 0, right: 0 },
        }
    ));
    console.log(DIM(`  Cluster: ${getCluster()}  |  Wallet: ${shortKey(loadWallet().publicKey)}\n`));
}

function txSuccess(label: string, sig: string) {
    console.log('');
    console.log(SUCCESS('  ✓ ') + BOLD(label));
    console.log(DIM('    Signature: ') + MONO(sig));
    console.log(DIM('    Explorer:  ') + chalk.underline.hex('#7c3aed')(explorerUrl(sig)));
    console.log('');
}

function txFailed(label: string, err: any) {
    console.log('');
    console.log(ERROR('  ✗ ') + BOLD(label));
    const msg = err?.message || String(err);
    // Extract the anchor error if present
    const anchorMatch = msg.match(/Error Code: (\w+)/);
    if (anchorMatch) {
        console.log(ERROR(`    Error: ${anchorMatch[1]}`));
    } else {
        console.log(ERROR(`    ${msg.slice(0, 200)}`));
    }
    if (err?.signature) {
        console.log(DIM('    Signature: ') + MONO(err.signature));
        console.log(DIM('    Explorer:  ') + chalk.underline.hex('#ef4444')(explorerUrl(err.signature)));
    }
    console.log('');
}

// ────────────────────────────────────────────────────────────────────────────
// Commands
// ────────────────────────────────────────────────────────────────────────────

const cli = new Command();

cli
    .name('rbac-cli')
    .description('RBAC On-Chain Engine — Solana Program CLI')
    .version('1.0.0')
    .hook('preAction', () => banner());

// ── init ────────────────────────────────────────────────────────

cli
    .command('init')
    .description('Initialize the RBAC system (sets you as super admin)')
    .action(async () => {
        const { program, wallet } = getProgram();
        const spinner = ora({ text: 'Initializing RBAC system...', color: 'magenta' }).start();
        try {
            const sig = await program.methods
                .initialize()
                .accounts({ authority: wallet.publicKey })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess('RBAC system initialized', sig);
            console.log(DIM(`    Super Admin: ${wallet.publicKey.toBase58()}`));
        } catch (err: any) {
            spinner.stop();
            txFailed('Failed to initialize', err);
        }
    });

// ── create-role ─────────────────────────────────────────────────

cli
    .command('create-role <name>')
    .description('Create a new role (max 32 chars)')
    .action(async (name: string) => {
        const { program, wallet } = getProgram();
        const spinner = ora({ text: `Creating role "${name}"...`, color: 'magenta' }).start();
        try {
            const sig = await program.methods
                .createRole(name)
                .accounts({ authority: wallet.publicKey })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`Role "${name}" created`, sig);
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to create role "${name}"`, err);
        }
    });

// ── create-permission ───────────────────────────────────────────

cli
    .command('create-permission <name> <resource> <action>')
    .description('Create a new permission (e.g., read_medical medical_record read)')
    .action(async (name: string, resource: string, action: string) => {
        const { program, wallet } = getProgram();
        const spinner = ora({ text: `Creating permission "${name}"...`, color: 'magenta' }).start();
        try {
            const sig = await program.methods
                .createPermission(name, resource, action)
                .accounts({ authority: wallet.publicKey })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`Permission "${name}" created`, sig);
            console.log(DIM(`    Resource: ${resource}  |  Action: ${action}`));
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to create permission "${name}"`, err);
        }
    });

// ── assign-permission ───────────────────────────────────────────

cli
    .command('assign-permission <role_name> <perm_name>')
    .description('Link a permission to a role')
    .action(async (roleName: string, permName: string) => {
        const { program, wallet, programId } = getProgram();
        const spinner = ora({ text: `Linking "${permName}" → "${roleName}"...`, color: 'magenta' }).start();
        try {
            const role = rolePda(roleName, programId);
            const perm = permissionPda(permName, programId);
            const sig = await program.methods
                .assignPermissionToRole()
                .accountsPartial({
                    role, permission: perm,
                    authority: wallet.publicKey,
                })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`"${permName}" linked to "${roleName}"`, sig);
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to link permission`, err);
        }
    });

// ── revoke-permission ───────────────────────────────────────────

cli
    .command('revoke-permission <role_name> <perm_name>')
    .description('Unlink a permission from a role')
    .action(async (roleName: string, permName: string) => {
        const { program, wallet, programId } = getProgram();
        const spinner = ora({ text: `Unlinking "${permName}" from "${roleName}"...`, color: 'magenta' }).start();
        try {
            const role = rolePda(roleName, programId);
            const perm = permissionPda(permName, programId);
            const sig = await program.methods
                .revokePermissionFromRole()
                .accountsPartial({
                    role, permission: perm,
                    authority: wallet.publicKey,
                })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`"${permName}" unlinked from "${roleName}"`, sig);
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to unlink permission`, err);
        }
    });

// ── assign-role ─────────────────────────────────────────────────

cli
    .command('assign-role <user_pubkey> <role_name>')
    .description('Assign a role to a user')
    .action(async (userPubkey: string, roleName: string) => {
        const { program, wallet, programId } = getProgram();
        const spinner = ora({ text: `Assigning "${roleName}" to ${shortKey(userPubkey)}...`, color: 'magenta' }).start();
        try {
            const userPk = new PublicKey(userPubkey);
            const role = rolePda(roleName, programId);
            const sig = await program.methods
                .assignRoleToUser()
                .accountsPartial({
                    role, user: userPk,
                    authority: wallet.publicKey,
                })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`"${roleName}" assigned to ${shortKey(userPubkey)}`, sig);
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to assign role`, err);
        }
    });

// ── revoke-role ─────────────────────────────────────────────────

cli
    .command('revoke-role <user_pubkey> <role_name>')
    .description('Revoke a role from a user')
    .action(async (userPubkey: string, roleName: string) => {
        const { program, wallet, programId } = getProgram();
        const spinner = ora({ text: `Revoking "${roleName}" from ${shortKey(userPubkey)}...`, color: 'magenta' }).start();
        try {
            const userPk = new PublicKey(userPubkey);
            const role = rolePda(roleName, programId);
            const sig = await program.methods
                .revokeRoleFromUser()
                .accountsPartial({
                    role, user: userPk,
                    authority: wallet.publicKey,
                })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`"${roleName}" revoked from ${shortKey(userPubkey)}`, sig);
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to revoke role`, err);
        }
    });

// ── check-access ────────────────────────────────────────────────

cli
    .command('check-access <user_pubkey> <role_name> <perm_name>')
    .description('Verify on-chain access (user + role + permission)')
    .action(async (userPubkey: string, roleName: string, permName: string) => {
        const { program, wallet, programId } = getProgram();
        const spinner = ora({ text: `Checking access...`, color: 'magenta' }).start();
        try {
            const userPk = new PublicKey(userPubkey);
            const role = rolePda(roleName, programId);
            const perm = permissionPda(permName, programId);
            const ur = userRolePda(userPk, role, programId);
            const rp = rolePermissionPda(role, perm, programId);

            const sig = await program.methods
                .checkAccess()
                .accountsPartial({
                    user: userPk,
                    role, permission: perm,
                    userRole: ur, rolePermission: rp,
                })
                .signers([wallet])
                .rpc();

            spinner.stop();
            console.log('');
            console.log(
                boxen(
                    SUCCESS.bold('ACCESS GRANTED ✓') + '\n\n' +
                    DIM('User:       ') + MONO(shortKey(userPubkey)) + '\n' +
                    DIM('Role:       ') + BRAND(roleName) + '\n' +
                    DIM('Permission: ') + BRAND(permName),
                    {
                        padding: { top: 0, bottom: 0, left: 2, right: 2 },
                        borderColor: '#22c55e',
                        borderStyle: 'round',
                        margin: { top: 0, bottom: 0, left: 1, right: 0 },
                    }
                )
            );
            console.log(DIM('    Signature: ') + MONO(sig));
            console.log(DIM('    Explorer:  ') + chalk.underline.hex('#22c55e')(explorerUrl(sig)));
            console.log('');
        } catch (err: any) {
            spinner.stop();
            console.log('');
            console.log(
                boxen(
                    ERROR.bold('ACCESS DENIED ✗') + '\n\n' +
                    DIM('User:       ') + MONO(shortKey(userPubkey)) + '\n' +
                    DIM('Role:       ') + BRAND(roleName) + '\n' +
                    DIM('Permission: ') + BRAND(permName),
                    {
                        padding: { top: 0, bottom: 0, left: 2, right: 2 },
                        borderColor: '#ef4444',
                        borderStyle: 'round',
                        margin: { top: 0, bottom: 0, left: 1, right: 0 },
                    }
                )
            );
            if (err?.signature) {
                console.log(DIM('    Signature: ') + MONO(err.signature));
                console.log(DIM('    Explorer:  ') + chalk.underline.hex('#ef4444')(explorerUrl(err.signature)));
            }
            console.log('');
        }
    });

// ── list-roles ──────────────────────────────────────────────────

cli
    .command('list-roles')
    .description('List all roles on-chain')
    .action(async () => {
        const { program } = getProgram();
        const spinner = ora({ text: 'Fetching roles...', color: 'magenta' }).start();
        try {
            const allRoles = await (program.account as any).role.all();
            spinner.stop();

            if (allRoles.length === 0) {
                console.log(DIM('\n  No roles found.\n'));
                return;
            }

            const table = new Table({
                head: [
                    chalk.hex('#7c3aed').bold('NAME'),
                    chalk.hex('#7c3aed').bold('PDA'),
                    chalk.hex('#7c3aed').bold('CREATED'),
                ],
                style: { head: [], border: ['dim'] },
                chars: {
                    'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
                    'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
                    'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
                    'right': '│', 'right-mid': '┤', 'middle': '│',
                },
            });

            for (const r of allRoles) {
                const ts = r.account.createdAt?.toNumber();
                table.push([
                    chalk.white.bold(r.account.name),
                    MONO(shortKey(r.publicKey)),
                    ts ? DIM(new Date(ts * 1000).toLocaleString()) : DIM('—'),
                ]);
            }
            console.log(`\n  ${BOLD(`Roles (${allRoles.length})`)}\n`);
            console.log(table.toString());
            console.log('');
        } catch (err: any) {
            spinner.stop();
            txFailed('Failed to fetch roles', err);
        }
    });

// ── list-permissions ────────────────────────────────────────────

cli
    .command('list-permissions')
    .description('List all permissions on-chain')
    .action(async () => {
        const { program } = getProgram();
        const spinner = ora({ text: 'Fetching permissions...', color: 'magenta' }).start();
        try {
            const allPerms = await (program.account as any).permission.all();
            spinner.stop();

            if (allPerms.length === 0) {
                console.log(DIM('\n  No permissions found.\n'));
                return;
            }

            const table = new Table({
                head: [
                    chalk.hex('#7c3aed').bold('NAME'),
                    chalk.hex('#7c3aed').bold('RESOURCE'),
                    chalk.hex('#7c3aed').bold('ACTION'),
                    chalk.hex('#7c3aed').bold('PDA'),
                ],
                style: { head: [], border: ['dim'] },
                chars: {
                    'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
                    'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
                    'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
                    'right': '│', 'right-mid': '┤', 'middle': '│',
                },
            });

            for (const p of allPerms) {
                table.push([
                    chalk.white.bold(p.account.name),
                    MONO(p.account.resource),
                    MONO(p.account.action),
                    MONO(shortKey(p.publicKey)),
                ]);
            }
            console.log(`\n  ${BOLD(`Permissions (${allPerms.length})`)}\n`);
            console.log(table.toString());
            console.log('');
        } catch (err: any) {
            spinner.stop();
            txFailed('Failed to fetch permissions', err);
        }
    });

// ── list-users ──────────────────────────────────────────────────

cli
    .command('list-users')
    .description('List all user-role assignments on-chain')
    .action(async () => {
        const { program } = getProgram();
        const spinner = ora({ text: 'Fetching user assignments...', color: 'magenta' }).start();
        try {
            const allUR = await (program.account as any).userRole.all();
            const allRoles = await (program.account as any).role.all();
            spinner.stop();

            if (allUR.length === 0) {
                console.log(DIM('\n  No user-role assignments found.\n'));
                return;
            }

            const roleMap = new Map<string, string>();
            for (const r of allRoles) {
                roleMap.set(r.publicKey.toBase58(), r.account.name);
            }

            const table = new Table({
                head: [
                    chalk.hex('#7c3aed').bold('USER'),
                    chalk.hex('#7c3aed').bold('ROLE'),
                    chalk.hex('#7c3aed').bold('PDA'),
                ],
                style: { head: [], border: ['dim'] },
                chars: {
                    'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
                    'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
                    'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
                    'right': '│', 'right-mid': '┤', 'middle': '│',
                },
            });

            for (const ur of allUR) {
                const roleName = roleMap.get(ur.account.role.toBase58()) || shortKey(ur.account.role);
                table.push([
                    MONO(ur.account.user.toBase58()),
                    chalk.white.bold(roleName),
                    MONO(shortKey(ur.publicKey)),
                ]);
            }
            console.log(`\n  ${BOLD(`User Assignments (${allUR.length})`)}\n`);
            console.log(table.toString());
            console.log('');
        } catch (err: any) {
            spinner.stop();
            txFailed('Failed to fetch users', err);
        }
    });

// ── status ──────────────────────────────────────────────────────

cli
    .command('status')
    .description('Show RBAC system status')
    .action(async () => {
        const { program, programId } = getProgram();
        const spinner = ora({ text: 'Fetching status...', color: 'magenta' }).start();
        try {
            const state = rbacStatePda(programId);
            const acct = await (program.account as any).rbacState.fetch(state);
            spinner.stop();

            console.log('');
            console.log(boxen(
                BRAND.bold('SYSTEM STATUS') + '\n\n' +
                DIM('Program ID:   ') + MONO(programId.toBase58()) + '\n' +
                DIM('Super Admin:  ') + chalk.white.bold(acct.superAdmin.toBase58()) + '\n' +
                DIM('Total Roles:  ') + BRAND.bold(acct.totalRoles.toString()) + '\n' +
                DIM('Total Perms:  ') + BRAND.bold(acct.totalPermissions.toString()) + '\n' +
                DIM('Cluster:      ') + MONO(getCluster()),
                {
                    padding: { top: 0, bottom: 0, left: 2, right: 2 },
                    borderColor: '#7c3aed',
                    borderStyle: 'round',
                    margin: { top: 0, bottom: 0, left: 1, right: 0 },
                }
            ));
            console.log('');
        } catch (err: any) {
            spinner.stop();
            console.log('');
            console.log(ERROR('  ✗ RBAC system not initialized'));
            console.log(DIM('    Run: rbac-cli init\n'));
        }
    });

// ── remove-role ─────────────────────────────────────────────────

cli
    .command('remove-role <name>')
    .description('Remove a role (closes the PDA)')
    .action(async (name: string) => {
        const { program, wallet, programId } = getProgram();
        const spinner = ora({ text: `Removing role "${name}"...`, color: 'magenta' }).start();
        try {
            const role = rolePda(name, programId);
            const sig = await program.methods
                .removeRole()
                .accountsPartial({ role, authority: wallet.publicKey })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`Role "${name}" removed`, sig);
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to remove role "${name}"`, err);
        }
    });

// ── remove-permission ───────────────────────────────────────────

cli
    .command('remove-permission <name>')
    .description('Remove a permission (closes the PDA)')
    .action(async (name: string) => {
        const { program, wallet, programId } = getProgram();
        const spinner = ora({ text: `Removing permission "${name}"...`, color: 'magenta' }).start();
        try {
            const perm = permissionPda(name, programId);
            const sig = await program.methods
                .removePermission()
                .accountsPartial({ permission: perm, authority: wallet.publicKey })
                .signers([wallet])
                .rpc();
            spinner.stop();
            txSuccess(`Permission "${name}" removed`, sig);
        } catch (err: any) {
            spinner.stop();
            txFailed(`Failed to remove permission "${name}"`, err);
        }
    });

// ── demo ────────────────────────────────────────────────────────

cli
    .command('demo')
    .description('Run a full hospital records demo (init → roles → perms → assign → check)')
    .action(async () => {
        const { program, wallet, programId } = getProgram();

        console.log(boxen(
            BRAND.bold('HOSPITAL RECORDS DEMO') + '\n' +
            DIM('Full RBAC lifecycle on-chain'),
            {
                padding: { top: 0, bottom: 0, left: 2, right: 2 },
                borderColor: '#7c3aed',
                borderStyle: 'round',
                margin: { top: 0, bottom: 0, left: 1, right: 0 },
            }
        ));

        const steps = [
            {
                label: '1. Initialize RBAC', fn: async () => {
                    try {
                        return await program.methods.initialize()
                            .accounts({ authority: wallet.publicKey })
                            .signers([wallet]).rpc();
                    } catch (e: any) {
                        if (e.message?.includes('already in use')) return 'SKIP_ALREADY_INIT';
                        throw e;
                    }
                }
            },
            {
                label: '2. Create role: doctor', fn: () =>
                    program.methods.createRole('doctor')
                        .accounts({ authority: wallet.publicKey })
                        .signers([wallet]).rpc()
            },
            {
                label: '3. Create role: nurse', fn: () =>
                    program.methods.createRole('nurse')
                        .accounts({ authority: wallet.publicKey })
                        .signers([wallet]).rpc()
            },
            {
                label: '4. Create permission: read_medical', fn: () =>
                    program.methods.createPermission('read_medical', 'medical_record', 'read')
                        .accounts({ authority: wallet.publicKey })
                        .signers([wallet]).rpc()
            },
            {
                label: '5. Create permission: write_medical', fn: () =>
                    program.methods.createPermission('write_medical', 'medical_record', 'write')
                        .accounts({ authority: wallet.publicKey })
                        .signers([wallet]).rpc()
            },
            {
                label: '6. Link: doctor → read_medical', fn: () =>
                    program.methods.assignPermissionToRole()
                        .accountsPartial({
                            role: rolePda('doctor', programId),
                            permission: permissionPda('read_medical', programId),
                            authority: wallet.publicKey,
                        })
                        .signers([wallet]).rpc()
            },
            {
                label: '7. Link: doctor → write_medical', fn: () =>
                    program.methods.assignPermissionToRole()
                        .accountsPartial({
                            role: rolePda('doctor', programId),
                            permission: permissionPda('write_medical', programId),
                            authority: wallet.publicKey,
                        })
                        .signers([wallet]).rpc()
            },
            {
                label: '8. Link: nurse → read_medical (only)', fn: () =>
                    program.methods.assignPermissionToRole()
                        .accountsPartial({
                            role: rolePda('nurse', programId),
                            permission: permissionPda('read_medical', programId),
                            authority: wallet.publicKey,
                        })
                        .signers([wallet]).rpc()
            },
            {
                label: '9. Assign: self → doctor', fn: () =>
                    program.methods.assignRoleToUser()
                        .accountsPartial({
                            role: rolePda('doctor', programId),
                            user: wallet.publicKey,
                            authority: wallet.publicKey,
                        })
                        .signers([wallet]).rpc()
            },
        ];

        for (const step of steps) {
            const spinner = ora({ text: step.label, color: 'magenta' }).start();
            try {
                const sig = await step.fn();
                spinner.stop();
                if (sig === 'SKIP_ALREADY_INIT') {
                    console.log(DIM(`  ○ ${step.label} (already done)`));
                } else {
                    console.log(SUCCESS(`  ✓ ${step.label}`));
                    console.log(DIM(`    ${explorerUrl(sig)}`));
                }
            } catch (err: any) {
                spinner.stop();
                console.log(ERROR(`  ✗ ${step.label}`));
                const anchorMatch = err?.message?.match(/Error Code: (\w+)/);
                console.log(ERROR(`    ${anchorMatch ? anchorMatch[1] : err?.message?.slice(0, 100)}`));
            }
        }

        // Check access
        console.log('');
        console.log(BOLD('  Access Checks:'));

        const doctorRole = rolePda('doctor', programId);
        const nurseRole = rolePda('nurse', programId);
        const readPerm = permissionPda('read_medical', programId);
        const writePerm = permissionPda('write_medical', programId);

        // Doctor → read (should pass)
        try {
            const sig = await program.methods.checkAccess()
                .accountsPartial({
                    user: wallet.publicKey,
                    role: doctorRole, permission: readPerm,
                    userRole: userRolePda(wallet.publicKey, doctorRole, programId),
                    rolePermission: rolePermissionPda(doctorRole, readPerm, programId),
                })
                .signers([wallet]).rpc();
            console.log(SUCCESS(`  ✓ Doctor → read_medical: GRANTED`));
            console.log(DIM(`    ${explorerUrl(sig)}`));
        } catch {
            console.log(ERROR(`  ✗ Doctor → read_medical: DENIED`));
        }

        // Doctor → write (should pass)
        try {
            const sig = await program.methods.checkAccess()
                .accountsPartial({
                    user: wallet.publicKey,
                    role: doctorRole, permission: writePerm,
                    userRole: userRolePda(wallet.publicKey, doctorRole, programId),
                    rolePermission: rolePermissionPda(doctorRole, writePerm, programId),
                })
                .signers([wallet]).rpc();
            console.log(SUCCESS(`  ✓ Doctor → write_medical: GRANTED`));
            console.log(DIM(`    ${explorerUrl(sig)}`));
        } catch {
            console.log(ERROR(`  ✗ Doctor → write_medical: DENIED`));
        }

        // Nurse check (wallet isn't assigned nurse, so should fail)
        try {
            await program.methods.checkAccess()
                .accountsPartial({
                    user: wallet.publicKey,
                    role: nurseRole, permission: writePerm,
                    userRole: userRolePda(wallet.publicKey, nurseRole, programId),
                    rolePermission: rolePermissionPda(nurseRole, writePerm, programId),
                })
                .signers([wallet]).rpc();
            console.log(SUCCESS(`  ✓ Nurse → write_medical: GRANTED`));
        } catch {
            console.log(ERROR(`  ✗ Nurse → write_medical: DENIED (expected — not assigned)`));
        }

        console.log('');
        console.log(SUCCESS.bold('  Demo complete! All transactions on-chain.\n'));
    });

// ────────────────────────────────────────────────────────────────────────────

cli.parse();
