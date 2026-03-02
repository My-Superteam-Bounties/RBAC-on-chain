import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { UserPlus, UserMinus, AlertCircle, Users, Copy } from 'lucide-react';

interface UserRoleEntry {
    publicKey: PublicKey;
    user: string;
    roleName: string;
    roleKey: PublicKey;
}

interface Role { publicKey: PublicKey; name: string; }

interface Props {
    program: any;
    userRoles: UserRoleEntry[];
    roles: Role[];
    onRefresh: () => void;
    onTx: (title: string, sig?: string, success?: boolean) => void;
}

export default function UserRoleManager({ program, userRoles, roles, onRefresh, onTx }: Props) {
    const { publicKey } = useWallet();
    const [userAddress, setUserAddress] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAssign = async () => {
        if (!program || !publicKey || !userAddress.trim() || !selectedRole) return;
        setLoading(true); setError('');
        try {
            const userPk = new PublicKey(userAddress.trim());
            const role = roles.find(r => r.name === selectedRole);
            if (!role) throw new Error('Role not found');
            const sig = await program.methods
                .assignRoleToUser()
                .accountsPartial({
                    role: role.publicKey,
                    user: userPk,
                    authority: publicKey,
                })
                .rpc();
            onTx(`"${selectedRole}" assigned to user`, sig, true);
            setUserAddress(''); setSelectedRole('');
            onRefresh();
        } catch (err: any) {
            const msg = err?.message?.slice(0, 120) || 'Transaction failed';
            setError(msg);
            onTx(`Failed to assign role`, err?.signature, false);
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (ur: UserRoleEntry) => {
        if (!program || !publicKey) return;
        setLoading(true); setError('');
        try {
            const sig = await program.methods
                .revokeRoleFromUser()
                .accountsPartial({
                    role: ur.roleKey,
                    user: new PublicKey(ur.user),
                    authority: publicKey,
                })
                .rpc();
            onTx(`"${ur.roleName}" revoked from user`, sig, true);
            onRefresh();
        } catch (err: any) {
            const msg = err?.message?.slice(0, 120) || 'Transaction failed';
            setError(msg);
            onTx(`Failed to revoke role`, err?.signature, false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h3 className="panel-title"><Users /> User → Role Assignments</h3>
                <span className="panel-badge">{userRoles.length}</span>
            </div>

            {error && (
                <div className="inline-error"><AlertCircle />{error}</div>
            )}

            <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">User Public Key</label>
                    <input className="form-input form-input-mono" placeholder="User wallet address" value={userAddress} onChange={e => setUserAddress(e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                        <option value="">Select role...</option>
                        {roles.map(r => (
                            <option key={r.publicKey.toBase58()} value={r.name}>{r.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleAssign} disabled={loading || !userAddress.trim() || !selectedRole}>
                        {loading ? <span className="spinner" /> : <><UserPlus /> Assign</>}
                    </button>
                </div>
            </div>

            {userRoles.length > 0 ? (
                <div className="item-list">
                    {userRoles.map(ur => (
                        <div className="item-card" key={ur.publicKey.toBase58()}>
                            <div className="item-info">
                                <div className="item-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', fontWeight: 500 }}>
                                        {ur.user.slice(0, 4)}...{ur.user.slice(-4)}
                                    </span>
                                    <Copy
                                        style={{ width: 12, height: 12, cursor: 'pointer', color: 'var(--text-muted)' }}
                                        onClick={() => navigator.clipboard.writeText(ur.user)}
                                    />
                                </div>
                                <div className="item-meta">
                                    <span className="item-meta-entry" style={{ color: 'var(--accent-hover)' }}>{ur.roleName}</span>
                                </div>
                            </div>
                            <div className="item-actions">
                                <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(ur)} disabled={loading}>
                                    <UserMinus />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <Users />
                    No role assignments yet
                </div>
            )}
        </div>
    );
}
