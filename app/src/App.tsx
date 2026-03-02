import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  ShieldCheck, Shield, KeyRound, Users, Activity,
  RefreshCw, Wallet, Power
} from 'lucide-react';
import { useRbacProgram, rbacStatePda } from './hooks/useRbacProgram';
import RoleManager from './components/RoleManager';
import PermissionManager from './components/PermissionManager';
import UserRoleManager from './components/UserRoleManager';
import RolePermissionManager from './components/RolePermissionManager';
import AccessChecker from './components/AccessChecker';
import TxToast, { useTxToast } from './components/TxToast';
import './App.css';

type Tab = 'roles' | 'permissions' | 'assignments' | 'access';

function App() {
  const { publicKey, connected } = useWallet();
  const { program, programId } = useRbacProgram();
  const { toasts, addToast, removeToast } = useTxToast();

  const [tab, setTab] = useState<Tab>('roles');
  const [initialized, setInitialized] = useState(false);
  const [superAdmin, setSuperAdmin] = useState<string | null>(null);
  const [totalRoles, setTotalRoles] = useState(0);
  const [totalPermissions, setTotalPermissions] = useState(0);
  const [loading, setLoading] = useState(false);

  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);

  // ── Tx callback ──────────────────────────────────────────────
  const handleTx = useCallback((title: string, sig?: string, success = true) => {
    addToast(title, sig, success);
  }, [addToast]);

  // ── Fetch state ──────────────────────────────────────────────

  const fetchState = useCallback(async () => {
    if (!program) return;
    try {
      const state = rbacStatePda(programId);
      const acct = await (program.account as any).rbacState.fetch(state);
      setInitialized(true);
      setSuperAdmin(acct.superAdmin.toBase58());
      setTotalRoles((acct.totalRoles as any).toNumber());
      setTotalPermissions((acct.totalPermissions as any).toNumber());
    } catch {
      setInitialized(false);
      setSuperAdmin(null);
    }
  }, [program, programId]);

  const fetchAll = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      await fetchState();

      const allRoles = await (program.account as any).role.all();
      setRoles(allRoles.map((r: any) => ({
        publicKey: r.publicKey,
        name: r.account.name,
        createdAt: r.account.createdAt?.toNumber() || 0,
      })));

      const allPerms = await (program.account as any).permission.all();
      setPermissions(allPerms.map((p: any) => ({
        publicKey: p.publicKey,
        name: p.account.name,
        resource: p.account.resource,
        action: p.account.action,
      })));

      const allUR = await (program.account as any).userRole.all();
      const roleMap = new Map(allRoles.map((r: any) => [r.publicKey.toBase58(), r.account.name]));
      setUserRoles(allUR.map((ur: any) => ({
        publicKey: ur.publicKey,
        user: ur.account.user.toBase58(),
        roleName: roleMap.get(ur.account.role.toBase58()) || ur.account.role.toBase58().slice(0, 8) + '...',
        roleKey: ur.account.role,
      })));

      const allRP = await (program.account as any).rolePermission.all();
      const permMap = new Map(allPerms.map((p: any) => [p.publicKey.toBase58(), p.account.name]));
      setRolePermissions(allRP.map((rp: any) => ({
        publicKey: rp.publicKey,
        roleName: roleMap.get(rp.account.role.toBase58()) || rp.account.role.toBase58().slice(0, 8) + '...',
        permissionName: permMap.get(rp.account.permission.toBase58()) || rp.account.permission.toBase58().slice(0, 8) + '...',
        roleKey: rp.account.role,
        permissionKey: rp.account.permission,
      })));
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [program, programId, fetchState]);

  useEffect(() => {
    if (program) fetchAll();
  }, [program]);

  const handleInit = async () => {
    if (!program || !publicKey) return;
    setLoading(true);
    try {
      const sig = await program.methods
        .initialize()
        .accounts({ authority: publicKey })
        .rpc();
      handleTx('RBAC System initialized', sig, true);
      await fetchAll();
    } catch (err: any) {
      console.error('Init failed:', err);
      handleTx('Initialization failed', err?.signature, false);
    } finally {
      setLoading(false);
    }
  };

  // ── Not connected ────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="app-container">
        <div className="connect-prompt">
          <Wallet />
          <h2>RBAC On-Chain Engine</h2>
          <p>Connect your Solana wallet to manage roles, permissions, and access control — all verified on-chain.</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo"><ShieldCheck /></div>
          <div>
            <div className="app-title">RBAC Engine</div>
            <div className="app-subtitle">On-Chain Access Control</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={fetchAll} disabled={loading}>
            {loading ? <span className="spinner" /> : <RefreshCw style={{ width: 14, height: 14 }} />}
          </button>
          <WalletMultiButton />
        </div>
      </header>

      {/* State bar */}
      <div className="state-bar">
        <div className="state-bar-item">
          <span className="label">Status</span>
          <span className={`status-dot ${initialized ? '' : 'inactive'}`}></span>
          <span className="value">{initialized ? 'Active' : 'Not Initialized'}</span>
        </div>
        <div className="state-bar-item">
          <span className="label">Roles</span>
          <span className="value accent">{totalRoles}</span>
        </div>
        <div className="state-bar-item">
          <span className="label">Permissions</span>
          <span className="value accent">{totalPermissions}</span>
        </div>
        {superAdmin && (
          <div className="state-bar-item">
            <span className="label">Admin</span>
            <span className="value mono">{superAdmin.slice(0, 4)}...{superAdmin.slice(-4)}</span>
          </div>
        )}
        {!initialized && (
          <div className="init-button">
            <button className="btn btn-primary" onClick={handleInit} disabled={loading}>
              {loading ? <span className="spinner" /> : <><Power /> Initialize</>}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          <Shield /> Roles
        </button>
        <button className={`tab ${tab === 'permissions' ? 'active' : ''}`} onClick={() => setTab('permissions')}>
          <KeyRound /> Permissions
        </button>
        <button className={`tab ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>
          <Users /> Assignments
        </button>
        <button className={`tab ${tab === 'access' ? 'active' : ''}`} onClick={() => setTab('access')}>
          <Activity /> Access Check
        </button>
      </div>

      {/* Tab content */}
      {tab === 'roles' && (
        <RoleManager program={program} roles={roles} onRefresh={fetchAll} onTx={handleTx} />
      )}

      {tab === 'permissions' && (
        <PermissionManager program={program} permissions={permissions} onRefresh={fetchAll} onTx={handleTx} />
      )}

      {tab === 'assignments' && (
        <div className="two-col">
          <UserRoleManager program={program} userRoles={userRoles} roles={roles} onRefresh={fetchAll} onTx={handleTx} />
          <RolePermissionManager program={program} rolePermissions={rolePermissions} roles={roles} permissions={permissions} onRefresh={fetchAll} onTx={handleTx} />
        </div>
      )}

      {tab === 'access' && (
        <AccessChecker program={program} roles={roles} permissions={permissions} userRoles={userRoles} onTx={handleTx} />
      )}

      {/* Transaction toast notifications */}
      <TxToast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
