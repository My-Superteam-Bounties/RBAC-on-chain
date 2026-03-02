import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Activity, CheckCircle2, XCircle, Minus, Loader2, Building2 } from 'lucide-react';
import TxLink from './TxLink';

interface Role { publicKey: PublicKey; name: string; }
interface Permission { publicKey: PublicKey; name: string; resource: string; action: string; }
interface UserRoleEntry { publicKey: PublicKey; user: string; roleName: string; roleKey: PublicKey; }

interface Props {
    program: any;
    roles: Role[];
    permissions: Permission[];
    userRoles: UserRoleEntry[];
    onTx: (title: string, sig?: string, success?: boolean) => void;
}

type CellState = 'idle' | 'checking' | 'granted' | 'denied';

interface CellData {
    state: CellState;
    signature?: string;
}

export default function AccessChecker({ program, roles, permissions, userRoles, onTx }: Props) {
    const [matrix, setMatrix] = useState<Record<string, CellData>>({});

    const cellKey = (user: string, roleName: string, permName: string) =>
        `${user}:${roleName}:${permName}`;

    const checkAccess = async (userAddr: string, role: Role, perm: Permission) => {
        if (!program) return;
        const key = cellKey(userAddr, role.name, perm.name);
        setMatrix(prev => ({ ...prev, [key]: { state: 'checking' } }));

        try {
            const userPk = new PublicKey(userAddr);
            const [userRolePda] = PublicKey.findProgramAddressSync(
                [Buffer.from('user_role'), userPk.toBuffer(), role.publicKey.toBuffer()],
                program.programId
            );
            const [rolePermPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('role_permission'), role.publicKey.toBuffer(), perm.publicKey.toBuffer()],
                program.programId
            );

            const sig = await program.methods
                .checkAccess()
                .accountsPartial({
                    user: userPk,
                    role: role.publicKey,
                    permission: perm.publicKey,
                    userRole: userRolePda,
                    rolePermission: rolePermPda,
                })
                .rpc();

            setMatrix(prev => ({ ...prev, [key]: { state: 'granted', signature: sig } }));
            onTx(`Access GRANTED: ${role.name} → ${perm.name}`, sig, true);
        } catch (err: any) {
            setMatrix(prev => ({ ...prev, [key]: { state: 'denied', signature: err?.signature } }));
            onTx(`Access DENIED: ${role.name} → ${perm.name}`, err?.signature, false);
        }
    };

    const renderCell = (data: CellData) => {
        switch (data.state) {
            case 'checking': return <Loader2 className="checking" style={{ animation: 'spin 0.5s linear infinite' }} />;
            case 'granted': return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 className="granted" />
                    {data.signature && <TxLink signature={data.signature} label="Tx" />}
                </div>
            );
            case 'denied': return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <XCircle className="denied" />
                    {data.signature && <TxLink signature={data.signature} label="Tx" failed />}
                </div>
            );
            default: return <Minus className="pending" />;
        }
    };

    // Group user-roles by user
    const userMap = new Map<string, { roles: { name: string; key: PublicKey }[] }>();
    userRoles.forEach(ur => {
        if (!userMap.has(ur.user)) userMap.set(ur.user, { roles: [] });
        userMap.get(ur.user)!.roles.push({ name: ur.roleName, key: ur.roleKey });
    });

    return (
        <div className="panel">
            <div className="panel-header">
                <h3 className="panel-title"><Activity /> Access Verification</h3>
            </div>

            <div className="hospital-banner">
                <Building2 />
                <div className="hospital-banner-text">
                    <h3>Hospital Records Demo</h3>
                    <p>Click any cell to trigger an on-chain check_access transaction. Green = access granted with explorer link. Red = access denied.</p>
                </div>
            </div>

            {userMap.size === 0 || permissions.length === 0 ? (
                <div className="empty-state">
                    <Activity />
                    Assign roles to users and permissions to roles first
                </div>
            ) : (
                <table className="access-matrix">
                    <thead>
                        <tr>
                            <th>User / Role</th>
                            {permissions.map(p => (
                                <th key={p.publicKey.toBase58()} style={{ textAlign: 'center' }}>{p.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from(userMap.entries()).map(([user, data]) =>
                            data.roles.map((r, i) => {
                                const role = roles.find(rl => rl.publicKey.toBase58() === r.key.toBase58());
                                if (!role) return null;
                                return (
                                    <tr key={`${user}-${r.name}`}>
                                        <td>
                                            <div className="role-cell">
                                                {i === 0 && (
                                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                        {user.slice(0, 4)}..{user.slice(-4)}
                                                    </span>
                                                )}
                                                <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>{r.name}</span>
                                            </div>
                                        </td>
                                        {permissions.map(p => {
                                            const key = cellKey(user, role.name, p.name);
                                            const cellData = matrix[key] || { state: 'idle' as CellState };
                                            return (
                                                <td
                                                    key={p.publicKey.toBase58()}
                                                    className="access-check-cell"
                                                    onClick={() => checkAccess(user, role, p)}
                                                >
                                                    {renderCell(cellData)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}
