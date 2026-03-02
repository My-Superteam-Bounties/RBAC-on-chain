import { useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, type Idl, setProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import idl from '../../idl/rbac.json';

const PROGRAM_ID = new PublicKey(idl.address);

export function useRbacProgram() {
    const { connection } = useConnection();
    const wallet = useWallet();

    const provider = useMemo(() => {
        if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return null;
        const p = new AnchorProvider(
            connection,
            wallet as any,
            { commitment: 'confirmed' }
        );
        setProvider(p);
        return p;
    }, [connection, wallet]);

    const program = useMemo(() => {
        if (!provider) return null;
        return new Program(idl as Idl, provider);
    }, [provider]);

    return { program, provider, programId: PROGRAM_ID };
}

// ── PDA Derivation Helpers ─────────────────────────────────────────────

const RBAC_STATE_SEED = Buffer.from('rbac_state');
const ROLE_SEED = Buffer.from('role');
const PERMISSION_SEED = Buffer.from('permission');
const USER_ROLE_SEED = Buffer.from('user_role');
const ROLE_PERMISSION_SEED = Buffer.from('role_permission');

export function rbacStatePda(programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync([RBAC_STATE_SEED], programId);
    return pda;
}

export function rolePda(name: string, programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync([ROLE_SEED, Buffer.from(name)], programId);
    return pda;
}

export function permissionPda(name: string, programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync([PERMISSION_SEED, Buffer.from(name)], programId);
    return pda;
}

export function userRolePda(user: PublicKey, role: PublicKey, programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [USER_ROLE_SEED, user.toBuffer(), role.toBuffer()],
        programId
    );
    return pda;
}

export function rolePermissionPda(role: PublicKey, permission: PublicKey, programId: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [ROLE_PERMISSION_SEED, role.toBuffer(), permission.toBuffer()],
        programId
    );
    return pda;
}
