# RBAC On-Chain Engine — CLI

A graphical command-line interface for interacting with the RBAC Solana program on Devnet.

## Setup

```bash
# 1. Install dependencies
cd rbac/cli
yarn install

# 2. Build
yarn build

# 3. (Linux/macOS) Make executable
chmod +x dist/index.js

# 4. Link globally
npm link
```

After linking, `rbac-cli` is available as a global command.

> **Windows users:** Skip step 3 — `npm link` creates a `.cmd` wrapper automatically.

## Usage

```bash
# Show all commands
rbac-cli --help

# Check system status
rbac-cli status

# Run the full hospital records demo
rbac-cli demo
```

## Commands

| Command | Description |
|---|---|
| `init` | Initialize RBAC system (sets you as super admin) |
| `create-role <name>` | Create a new role (max 32 chars) |
| `create-permission <name> <resource> <action>` | Create a new permission |
| `assign-permission <role> <perm>` | Link a permission to a role |
| `revoke-permission <role> <perm>` | Unlink a permission from a role |
| `assign-role <pubkey> <role>` | Assign a role to a user |
| `revoke-role <pubkey> <role>` | Revoke a role from a user |
| `check-access <pubkey> <role> <perm>` | Verify access on-chain |
| `list-roles` | List all roles |
| `list-permissions` | List all permissions |
| `list-users` | List all user-role assignments |
| `status` | Show system overview |
| `remove-role <name>` | Close role PDA |
| `remove-permission <name>` | Close permission PDA |
| `demo` | Run full hospital records lifecycle |

## Example Workflow

```bash
rbac-cli init
rbac-cli create-role doctor
rbac-cli create-role nurse
rbac-cli create-permission read_medical medical_record read
rbac-cli create-permission write_medical medical_record write
rbac-cli assign-permission doctor read_medical
rbac-cli assign-permission doctor write_medical
rbac-cli assign-permission nurse read_medical
rbac-cli assign-role <USER_PUBKEY> doctor
rbac-cli check-access <USER_PUBKEY> doctor read_medical   # ✓ Granted
rbac-cli check-access <USER_PUBKEY> nurse write_medical    # ✗ Denied
```

Every command prints the Solana Explorer link for the transaction.

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `ANCHOR_WALLET` | `~/.config/solana/id.json` | Path to wallet keypair |
| `CLUSTER` | `devnet` | `devnet` or `localnet` |

```bash
# Use local validator
CLUSTER=localnet rbac-cli status

# Use custom wallet
ANCHOR_WALLET=./my-key.json rbac-cli list-roles
```
