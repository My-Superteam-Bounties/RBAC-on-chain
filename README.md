# 🏥 RBAC On-Chain Engine — Solana

> A production-quality **Role-Based Access Control (RBAC)** system built entirely on-chain as a Solana Anchor program. Demonstrates how traditional backend authorization patterns translate into Solana's account model using a **Hospital Records** analogy.

> **Built for the Superteam "Rebuild Backend Systems as On-Chain Rust Programs" Challenge**

---

## Table of Contents

- [Architecture: Web2 vs Solana](#architecture-web2-vs-solana)
- [Account Model & PDA Design](#account-model--pda-design)
- [Instruction Reference](#instruction-reference)
- [Hospital Records Analogy](#-hospital-records-analogy)
- [Tradeoffs & Constraints](#tradeoffs--constraints)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Devnet Deployment](#devnet-deployment)
- [CLI](#cli)
- [Frontend (Visual Test Harness)](#frontend-visual-test-harness)
- [Project Structure](#project-structure)

---

## Architecture: Web2 vs Solana

### How RBAC Works in Web2

In a traditional backend, RBAC is typically implemented with:

```
┌─────────────────────────────────────────────────────┐
│                    PostgreSQL DB                     │
│                                                     │
│  ┌──────────┐   ┌──────────────────┐   ┌─────────┐ │
│  │  users    │──▸│  user_roles      │◂──│  roles  │ │
│  │  ──────   │   │  ──────────      │   │  ─────  │ │
│  │  id       │   │  user_id (FK)    │   │  id     │ │
│  │  name     │   │  role_id (FK)    │   │  name   │ │
│  │  email    │   │                  │   │         │ │
│  └──────────┘   └──────────────────┘   └────┬────┘ │
│                                              │      │
│                 ┌──────────────────┐   ┌─────┴────┐ │
│                 │ role_permissions │◂──│permissions│ │
│                 │ ────────────────  │   │──────────│ │
│                 │ role_id (FK)     │   │ id       │ │
│                 │ permission_id(FK)│   │ name     │ │
│                 │                  │   │ resource │ │
│                 └──────────────────┘   │ action   │ │
│                                        └──────────┘ │
└─────────────────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │  API    │  ◂── Middleware checks
                    │ Server  │      permissions via
                    │(Node,Go)│      SQL JOINs
                    └────┬────┘
                         │
                    ┌────┴────┐
                    │ Client  │
                    └─────────┘
```

**Key Characteristics:**
- Centralized database stores all state
- API server enforces permissions via middleware
- JOINs across relational tables to check access
- Mutable, single-point-of-truth
- Trust model: "trust the server"

### How RBAC Works on Solana

```
┌──────────────────────────────────────────────────────────┐
│                Solana Blockchain (Accounts)               │
│                                                           │
│   ┌────────────┐                                         │
│   │ RbacState  │  ◂── Singleton root (super_admin, ctrs) │
│   │ PDA: [     │                                         │
│   │ "rbac_state│                                         │
│   │ "]         │                                         │
│   └────────────┘                                         │
│                                                           │
│   ┌──────────┐    ┌──────────────────┐    ┌───────────┐  │
│   │   Role   │◂───│  RolePermission  │───▸│Permission │  │
│   │   PDA    │    │      PDA         │    │   PDA     │  │
│   │["role",  │    │["role_permission"│    │["permis-  │  │
│   │ name]    │    │  role, perm]     │    │ sion",    │  │
│   └────┬─────┘    └──────────────────┘    │  name]    │  │
│        │                                   └───────────┘  │
│        │                                                  │
│   ┌────┴─────────┐                                       │
│   │  UserRole    │                                       │
│   │    PDA       │                                       │
│   │["user_role", │                                       │
│   │ user, role]  │                                       │
│   └──────────────┘                                       │
└──────────────────────────────────────────────────────────┘
                        │
                   ┌────┴────┐
                   │ Client  │  ◂── Signs & submits
                   │(React,  │      transactions directly
                   │ CLI)    │      to the blockchain
                   └─────────┘
```

**Key Characteristics:**
- Each "row" is a PDA (Program Derived Address) account
- Junction tables become junction PDAs
- Access check = proving all PDA accounts in the chain exist
- No server, no middleware — the program IS the authority
- Trust model: "trust the code, verified by the network"

---

## Account Model & PDA Design

| Account | Seeds | Size (bytes) | Purpose |
|---------|-------|-------------|---------|
| `RbacState` | `["rbac_state"]` | 56 | Singleton root — stores super_admin pubkey, role/permission counters |
| `Role` | `["role", name]` | 53 | Named role (e.g. "doctor") — stores name, created_at, bump |
| `Permission` | `["permission", name]` | 121 | Named permission — stores name, resource, action, created_at, bump |
| `UserRole` | `["user_role", user_pubkey, role_pubkey]` | 81 | Junction: user → role assignment |
| `RolePermission` | `["role_permission", role_pubkey, permission_pubkey]` | 81 | Junction: role → permission assignment |

### Why PDAs Instead of a Database?

Each PDA is deterministically derived from its seeds. This means:
- **Uniqueness is enforced by the runtime** — you cannot create two roles with the same name
- **Existence IS authorization** — if the UserRole PDA exists, the user has that role
- **Deletion IS revocation** — closing the PDA account removes the assignment
- **No indexing needed** — any client can derive the PDA address and check if it exists

---

## Instruction Reference

| # | Instruction | Signer | Accounts Required | Effect |
|---|------------|--------|-------------------|--------|
| 1 | `initialize` | Deployer | RbacState (init) | Creates singleton root, sets super_admin |
| 2 | `create_role` | Admin | RbacState, Role (init) | Creates a named Role PDA |
| 3 | `create_permission` | Admin | RbacState, Permission (init) | Creates a named Permission PDA |
| 4 | `assign_permission_to_role` | Admin | RbacState, Role, Permission, RolePermission (init) | Links permission → role |
| 5 | `revoke_permission_from_role` | Admin | RbacState, Role, Permission, RolePermission (close) | Unlinks permission from role |
| 6 | `assign_role_to_user` | Admin | RbacState, Role, User, UserRole (init) | Links role → user |
| 7 | `revoke_role_from_user` | Admin | RbacState, Role, User, UserRole (close) | Unlinks role from user |
| 8 | `check_access` | Anyone | User, Role, Permission, UserRole, RolePermission | Validates full PDA chain |
| 9 | `transfer_super_admin` | Admin | RbacState, NewAdmin | Transfers ownership |
| 10 | `remove_role` | Admin | RbacState, Role (close) | Deletes a Role PDA |
| 11 | `remove_permission` | Admin | RbacState, Permission (close) | Deletes a Permission PDA |

### How `check_access` Works

This is the most important instruction. It takes **five accounts**:

```
User → UserRole PDA → Role → RolePermission PDA → Permission
```

If **any** PDA in this chain does not exist, the transaction fails before entering the handler. This means:

- ✅ **Access granted** = transaction succeeds (all PDAs exist)
- ❌ **Access denied** = transaction fails (missing PDA)

No if/else. No boolean checks. **The account model IS the authorization logic.**

---

## 🏥 Hospital Records Analogy

The test suite and frontend use a hospital scenario to demonstrate RBAC:

### Roles
| Role | Description |
|------|-------------|
| `doctor` | Medical staff who treat patients |
| `nurse` | Support staff assisting doctors |
| `admin` | Hospital administrator |
| `patient` | Person receiving care |

### Permissions
| Permission | Resource | Action | Description |
|-----------|----------|--------|-------------|
| `read_medical_record` | medical_record | read | View patient medical records |
| `write_medical_record` | medical_record | write | Create/edit medical records |
| `update_prescription` | prescription | update | Modify prescriptions |
| `manage_users` | users | manage | Add/remove hospital staff |

### Access Matrix
| | read_medical | write_medical | update_rx | manage_users |
|---------|:---:|:---:|:---:|:---:|
| Doctor | ✅ | ✅ | ✅ | ❌ |
| Nurse | ✅ | ❌ | ❌ | ❌ |
| Admin | ❌ | ❌ | ❌ | ✅ |
| Patient | ✅ | ❌ | ❌ | ❌ |

---

## Tradeoffs & Constraints

### Advantages Over Web2 RBAC

| Aspect | Web2 | Solana |
|--------|------|--------|
| **Auditability** | Requires logging middleware | Every change is a signed, timestamped transaction |
| **Tamper resistance** | DB admin can modify records | Immutable transaction history |
| **Single point of failure** | Server downtime = no auth | Network always available |
| **Trust model** | "Trust the server" | "Trust the code" (verifiable) |
| **Portability** | Tied to your infrastructure | Any client can interact |

### Constraints & Limitations

| Constraint | Detail |
|-----------|--------|
| **Transaction costs** | Every role/permission change costs SOL (rent + tx fee) |
| **Name length** | Max 32 bytes per name — keeps accounts small and rent-efficient |
| **Single super_admin** | Only one admin authority (by design — can be transferred) |
| **No wildcard permissions** | Each user×role and role×permission is an explicit PDA |
| **Account size limits** | Each PDA must fit within Solana's 10MB account limit (not an issue here) |
| **Compute budget** | `check_access` must fit within one transaction's compute units |
| **No cascading deletes** | Removing a role does NOT auto-revoke UserRole/RolePermission PDAs |

### Design Decisions

1. **Existence-based authorization**: Instead of storing a boolean `has_access` field, we use PDA existence. If the junction account exists, access is granted. This is more gas-efficient and eliminates stale-data bugs.

2. **Monotonic counters**: `total_roles` and `total_permissions` only increment. This is intentional — they serve as historical counters, not array indices.

3. **No on-chain enumeration**: You cannot "list all roles" via a single on-chain call. This is a Solana constraint. The frontend uses `getProgramAccounts` with filters to enumerate.

---

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (1.89+)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (v2.x)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (0.32.x)
- [Node.js](https://nodejs.org/) (v18+)
- [Yarn](https://yarnpkg.com/)

### Setup

```bash
# Clone and enter the project
git clone <repo-url>
cd rbac

# Install JS dependencies
yarn install

# Build the Anchor program
anchor build

# Run tests (starts a local validator automatically)
anchor test
```

---

## Testing

The test suite (`tests/rbac.ts`) contains **25+ test cases** organized into 9 sections:

| Section | Tests | What It Covers |
|---------|-------|---------------|
| Initialization | 2 | Create RBAC state, prevent double-init |
| Role Management | 4 | Create roles, reject duplicates, reject long names, reject unauthorized |
| Permission Management | 3 | Create permissions, reject unauthorized |
| Assign Permissions to Roles | 4 | Doctor/Nurse/Admin/Patient permission assignments |
| Assign Roles to Users | 4 | User-role assignments, reject unauthorized |
| Access Checks | 9 | Allowed/denied scenarios for every role×permission combo |
| Revocation | 3 | Revoke permission, verify access denied, revoke role |
| Super Admin Transfer | 3 | Transfer, verify old admin rejected, restore |
| Removal | 2 | Remove role account, remove permission account |

Run tests:
```bash
anchor test
```

Expected output:
```
RBAC On-Chain Engine — Hospital Records
  Initialization
    ✅ initializes the RBAC system
    ✅ prevents double initialization
  Role Management
    ✅ creates a Doctor role
    ✅ creates a Nurse role
    ...
  Access Checks
    ✅ Doctor CAN read medical records
    ✅ Nurse CANNOT write medical records
    ...

  25 passing
```

---

## Devnet Deployment

```bash
# Switch to devnet
solana config set --url devnet

# Ensure you have SOL
solana airdrop 2

# Update Anchor.toml cluster to devnet
# [provider]
# cluster = "devnet"

# Build and deploy
anchor build
anchor deploy

# Note the deployed program ID from output
```

### Devnet Transaction Links

> _Links will be added after deployment_

---

## CLI

A graphical command-line interface for interacting with the RBAC program directly from your terminal. Designed for judges and developers to verify on-chain behavior without needing the frontend.

### Quick Start

```bash
cd cli
yarn install
yarn build
chmod +x dist/index.js   # Linux/macOS only
npm link
```

### Key Commands

```bash
rbac-cli init                                          # Initialize RBAC system
rbac-cli create-role doctor                            # Create a role
rbac-cli create-permission read_medical med_record read # Create a permission
rbac-cli assign-permission doctor read_medical          # Link perm → role
rbac-cli assign-role <USER_PUBKEY> doctor               # Assign role → user
rbac-cli check-access <USER_PUBKEY> doctor read_medical # Verify on-chain
rbac-cli demo                                          # Full hospital demo
```

Every command prints the Solana Explorer transaction link for verification.

> **Full documentation:** See [`cli/README.md`](cli/README.md) for all 15 commands, configuration options, and example workflows.

---

## Frontend (Visual Test Harness)

### Why a Minimal Frontend Exists

> A small frontend is included purely as a visualization and testing interface.
> The RBAC logic lives entirely on-chain. The frontend does not make authorization decisions — it only submits transactions and displays on-chain state.

### Architecture

```
┌────────────────────┐
│   Frontend UI      │
│   (React + Vite)   │
│   ─────────────    │
│   • No auth logic  │
│   • No backend     │
│   • No database    │
│   • Stateless      │
└────────┬───────────┘
         │ (signed transactions)
         ▼
┌────────────────────┐
│  RBAC Solana       │
│  Program           │
│  ─────────────     │
│  ALL logic here    │
└────────┬───────────┘
         │ (PDA accounts)
         ▼
┌────────────────────┐
│  Role / Permission │
│  PDAs on-chain     │
└────────────────────┘
```

### What the Frontend Does

- ✅ Connect wallet (Phantom, Solflare, etc.)
- ✅ Initialize RBAC system
- ✅ Create/view/remove roles
- ✅ Create/view/remove permissions
- ✅ Assign permissions to roles
- ✅ Assign/revoke roles to users
- ✅ Run access checks (Hospital Records demo)
- ✅ Display results (GRANTED / DENIED)

### What the Frontend Does NOT Do

- ❌ No authentication system
- ❌ No session management
- ❌ No authorization logic
- ❌ No caching of permissions
- ❌ No backend server

### Run the Frontend

```bash
cd app
yarn install
yarn dev
```

---

## Project Structure

```
rbac/
├── programs/rbac/src/
│   ├── lib.rs                          # Program entry point (11 instructions)
│   ├── state.rs                        # Account structs & PDA constants
│   ├── errors.rs                       # Custom error codes
│   ├── events.rs                       # Event definitions
│   └── instructions/
│       ├── mod.rs                      # Module barrel
│       ├── initialize.rs              # Create RBAC root state
│       ├── create_role.rs             # Create a named role
│       ├── create_permission.rs       # Create a named permission
│       ├── assign_permission_to_role.rs  # Link permission → role
│       ├── revoke_permission_from_role.rs # Unlink permission from role
│       ├── assign_role_to_user.rs     # Link role → user
│       ├── revoke_role_from_user.rs   # Unlink role from user
│       ├── check_access.rs           # Validate user→role→permission chain
│       ├── transfer_super_admin.rs    # Transfer admin authority
│       ├── remove_role.rs            # Delete role account
│       └── remove_permission.rs      # Delete permission account
├── tests/
│   └── rbac.ts                        # Comprehensive test suite (25+ cases)
├── cli/                               # Command-line interface
│   ├── src/
│   │   ├── index.ts                   # CLI entry point (15 commands)
│   │   └── helpers.ts                 # PDA derivation utilities
│   ├── package.json
│   └── README.md                      # Full CLI documentation
├── app/                               # React frontend (visual test harness)
│   ├── src/
│   │   ├── App.tsx                    # Main dashboard
│   │   ├── components/               # UI components
│   │   └── hooks/                    # Anchor program hooks
│   └── ...
├── Anchor.toml
├── Cargo.toml
└── README.md
```

---

## License

ISC

---

> **Built for the Superteam "Rebuild Backend Systems as On-Chain Rust Programs" Challenge**
> 
> This project demonstrates that Solana is not just a crypto platform — it is a distributed state machine capable of replacing traditional backend authorization systems with stronger guarantees: immutability, auditability, and zero-trust enforcement.
