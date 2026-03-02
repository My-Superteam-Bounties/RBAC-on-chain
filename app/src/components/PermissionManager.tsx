import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { KeyRound, Plus, Trash2, AlertCircle, FileText, Zap } from 'lucide-react';

interface Permission {
    publicKey: PublicKey;
    name: string;
    resource: string;
    action: string;
}

interface Props {
    program: any;
    permissions: Permission[];
    onRefresh: () => void;
}

export default function PermissionManager({ program, permissions, onRefresh }: Props) {
    const { publicKey } = useWallet();
    const [name, setName] = useState('');
    const [resource, setResource] = useState('');
    const [action, setAction] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!program || !publicKey || !name.trim() || !resource.trim() || !action.trim()) return;
        setLoading(true); setError('');
        try {
            await program.methods
                .createPermission(name.trim(), resource.trim(), action.trim())
                .accounts({ authority: publicKey })
                .rpc();
            setName(''); setResource(''); setAction('');
            onRefresh();
        } catch (err: any) {
            setError(err?.message?.slice(0, 120) || 'Transaction failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (permName: string) => {
        if (!program || !publicKey) return;
        setLoading(true); setError('');
        try {
            const [permPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('permission'), Buffer.from(permName)],
                program.programId
            );
            await program.methods
                .removePermission()
                .accountsPartial({ permission: permPda, authority: publicKey })
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
                <h3 className="panel-title"><KeyRound /> Permissions</h3>
                <span className="panel-badge">{permissions.length}</span>
            </div>

            {error && (
                <div className="inline-error"><AlertCircle />{error}</div>
            )}

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                        className="form-input"
                        placeholder="read_medical_record"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={32}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Resource</label>
                    <input
                        className="form-input"
                        placeholder="medical_record"
                        value={resource}
                        onChange={e => setResource(e.target.value)}
                        maxLength={32}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Action</label>
                    <input
                        className="form-input"
                        placeholder="read"
                        value={action}
                        onChange={e => setAction(e.target.value)}
                        maxLength={32}
                    />
                </div>
            </div>

            <div style={{ marginBottom: 20 }}>
                <button
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={loading || !name.trim() || !resource.trim() || !action.trim()}
                >
                    {loading ? <span className="spinner" /> : <><Plus /> Create Permission</>}
                </button>
            </div>

            {permissions.length > 0 ? (
                <div className="item-list">
                    {permissions.map(p => (
                        <div className="item-card" key={p.publicKey.toBase58()}>
                            <div className="item-info">
                                <div className="item-name">{p.name}</div>
                                <div className="item-meta">
                                    <span className="item-meta-entry"><FileText /> {p.resource}</span>
                                    <span className="item-meta-entry"><Zap /> {p.action}</span>
                                </div>
                            </div>
                            <div className="item-actions">
                                <button className="btn btn-danger btn-sm" onClick={() => handleRemove(p.name)} disabled={loading}>
                                    <Trash2 />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <KeyRound />
                    No permissions created yet
                </div>
            )}
        </div>
    );
}
