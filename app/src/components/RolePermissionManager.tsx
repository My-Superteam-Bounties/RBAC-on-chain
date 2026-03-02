import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Link, Unlink, AlertCircle, Workflow } from 'lucide-react';

interface RolePermissionEntry {
    publicKey: PublicKey;
    roleName: string;
    permissionName: string;
    roleKey: PublicKey;
    permissionKey: PublicKey;
}

interface Role { publicKey: PublicKey; name: string; }
interface Permission { publicKey: PublicKey; name: string; }

interface Props {
    program: any;
    rolePermissions: RolePermissionEntry[];
    roles: Role[];
    permissions: Permission[];
    onRefresh: () => void;
}

export default function RolePermissionManager({ program, rolePermissions, roles, permissions, onRefresh }: Props) {
    const { publicKey } = useWallet();
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedPerm, setSelectedPerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAssign = async () => {
        if (!program || !publicKey || !selectedRole || !selectedPerm) return;
        setLoading(true); setError('');
        try {
            const role = roles.find(r => r.name === selectedRole);
            const perm = permissions.find(p => p.name === selectedPerm);
            if (!role || !perm) throw new Error('Not found');
            await program.methods
                .assignPermissionToRole()
                .accountsPartial({
                    role: role.publicKey,
                    permission: perm.publicKey,
                    authority: publicKey,
                })
                .rpc();
            setSelectedRole(''); setSelectedPerm('');
            onRefresh();
        } catch (err: any) {
            setError(err?.message?.slice(0, 120) || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (rp: RolePermissionEntry) => {
        if (!program || !publicKey) return;
        setLoading(true); setError('');
        try {
            await program.methods
                .revokePermissionFromRole()
                .accountsPartial({
                    role: rp.roleKey,
                    permission: rp.permissionKey,
                    authority: publicKey,
                })
                .rpc();
            onRefresh();
        } catch (err: any) {
            setError(err?.message?.slice(0, 120) || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h3 className="panel-title"><Workflow /> Role → Permission Links</h3>
                <span className="panel-badge">{rolePermissions.length}</span>
            </div>

            {error && (
                <div className="inline-error"><AlertCircle />{error}</div>
            )}

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
                        <option value="">Select role...</option>
                        {roles.map(r => (
                            <option key={r.publicKey.toBase58()} value={r.name}>{r.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Permission</label>
                    <select className="form-select" value={selectedPerm} onChange={e => setSelectedPerm(e.target.value)}>
                        <option value="">Select permission...</option>
                        {permissions.map(p => (
                            <option key={p.publicKey.toBase58()} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleAssign} disabled={loading || !selectedRole || !selectedPerm}>
                        {loading ? <span className="spinner" /> : <><Link /> Link</>}
                    </button>
                </div>
            </div>

            {rolePermissions.length > 0 ? (
                <div className="item-list">
                    {rolePermissions.map(rp => (
                        <div className="item-card" key={rp.publicKey.toBase58()}>
                            <div className="item-info">
                                <div className="item-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--accent-hover)' }}>{rp.roleName}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</span>
                                    <span>{rp.permissionName}</span>
                                </div>
                            </div>
                            <div className="item-actions">
                                <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(rp)} disabled={loading}>
                                    <Unlink />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <Workflow />
                    No role-permission links yet
                </div>
            )}
        </div>
    );
}
