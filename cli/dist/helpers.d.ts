import { PublicKey } from '@solana/web3.js';
export declare function rbacStatePda(programId: PublicKey): PublicKey;
export declare function rolePda(name: string, programId: PublicKey): PublicKey;
export declare function permissionPda(name: string, programId: PublicKey): PublicKey;
export declare function userRolePda(user: PublicKey, role: PublicKey, programId: PublicKey): PublicKey;
export declare function rolePermissionPda(role: PublicKey, permission: PublicKey, programId: PublicKey): PublicKey;
export declare function explorerUrl(sig: string): string;
export declare function shortKey(key: string | PublicKey): string;
