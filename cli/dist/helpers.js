import { PublicKey } from '@solana/web3.js';
const RBAC_STATE_SEED = Buffer.from('rbac_state');
const ROLE_SEED = Buffer.from('role');
const PERMISSION_SEED = Buffer.from('permission');
const USER_ROLE_SEED = Buffer.from('user_role');
const ROLE_PERMISSION_SEED = Buffer.from('role_permission');
function findPda(seeds, programId) {
    const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
    return pda;
}
export function rbacStatePda(programId) {
    return findPda([RBAC_STATE_SEED], programId);
}
export function rolePda(name, programId) {
    return findPda([ROLE_SEED, Buffer.from(name)], programId);
}
export function permissionPda(name, programId) {
    return findPda([PERMISSION_SEED, Buffer.from(name)], programId);
}
export function userRolePda(user, role, programId) {
    return findPda([USER_ROLE_SEED, user.toBuffer(), role.toBuffer()], programId);
}
export function rolePermissionPda(role, permission, programId) {
    return findPda([ROLE_PERMISSION_SEED, role.toBuffer(), permission.toBuffer()], programId);
}
export function explorerUrl(sig) {
    return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}
export function shortKey(key) {
    const s = typeof key === 'string' ? key : key.toBase58();
    return `${s.slice(0, 4)}...${s.slice(-4)}`;
}
