import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Shield, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Role {
    publicKey: PublicKey;
    name: string;
    createdAt: number;
}

interface Props {
    program: any;
    roles: Role[];
    onRefresh: () => void;
    onTx: (title: string, sig?: string, success?: boolean) => void;
}

export default function RoleManager({ program, roles, onRefresh, onTx }: Props) {
    const { publicKey } = useWallet();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!program || !publicKey || !name.trim()) return;
        setLoading(true); setError('');
        try {
            const sig = await program.methods
                .createRole(name.trim())
                .accounts({ authority: publicKey })
                .rpc();
            onTx(`Role "${name.trim()}" created`, sig, true);
            setName('');
            onRefresh();
        } catch (err: any) {
            const msg = err?.message?.slice(0, 120) || 'Transaction failed';
            setError(msg);
            onTx(`Failed to create role`, err?.signature, false);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (roleName: string) => {
        if (!program || !publicKey) return;
        setLoading(true); setError('');
        try {
            const [rolePda] = PublicKey.findProgramAddressSync(
                [Buffer.from('role'), Buffer.from(roleName)],
                program.programId
            );
            const sig = await program.methods
                .removeRole()
                .accountsPartial({ role: rolePda, authority: publicKey })
                .rpc();
            onTx(`Role "${roleName}" removed`, sig, true);
            onRefresh();
        } catch (err: any) {
            const msg = err?.message?.slice(0, 120) || 'Transaction failed';
            setError(msg);
            onTx(`Failed to remove role`, err?.signature, false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="panel">
            <div className="panel-header">
                <h3 className="panel-title"><Shield /> Roles</h3>
                <span className="panel-badge">{roles.length}</span>
            </div>

            {error && (
                <div className="inline-error"><AlertCircle />{error}</div>
            )}

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Role Name</label>
                    <input
                        className="form-input"
                        placeholder="e.g. doctor, nurse, admin"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={32}
                        onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !name.trim()}>
                        {loading ? <span className="spinner" /> : <><Plus /> Create</>}
                    </button>
                </div>
            </div>

            {roles.length > 0 ? (
                <div className="item-list">
                    {roles.map(r => (
                        <div className="item-card" key={r.publicKey.toBase58()}>
                            <div className="item-info">
                                <div className="item-name">{r.name}</div>
                                <div className="item-meta">
                                    <span className="item-meta-entry">
                                        {r.createdAt ? new Date(r.createdAt * 1000).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                            </div>
                            <div className="item-actions">
                                <button className="btn btn-danger btn-sm" onClick={() => handleRemove(r.name)} disabled={loading}>
                                    <Trash2 />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <Shield />
                    No roles created yet
                </div>
            )}
        </div>
    );
}
