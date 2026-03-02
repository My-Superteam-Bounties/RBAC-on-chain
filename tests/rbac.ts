import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rbac } from "../target/types/rbac";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function findPda(seeds: (Buffer | Uint8Array)[], programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

const RBAC_STATE_SEED = Buffer.from("rbac_state");
const ROLE_SEED = Buffer.from("role");
const PERMISSION_SEED = Buffer.from("permission");
const USER_ROLE_SEED = Buffer.from("user_role");
const ROLE_PERMISSION_SEED = Buffer.from("role_permission");

function rbacStatePda(programId: PublicKey) {
  return findPda([RBAC_STATE_SEED], programId);
}

function rolePda(name: string, programId: PublicKey) {
  return findPda([ROLE_SEED, Buffer.from(name)], programId);
}

function permissionPda(name: string, programId: PublicKey) {
  return findPda([PERMISSION_SEED, Buffer.from(name)], programId);
}

function userRolePda(user: PublicKey, role: PublicKey, programId: PublicKey) {
  return findPda([USER_ROLE_SEED, user.toBuffer(), role.toBuffer()], programId);
}

function rolePermissionPda(role: PublicKey, permission: PublicKey, programId: PublicKey) {
  return findPda([ROLE_PERMISSION_SEED, role.toBuffer(), permission.toBuffer()], programId);
}

// ────────────────────────────────────────────────────────────────────────────
// Hospital Records RBAC — Comprehensive Test Suite
//
// Anchor 0.32 with `resolution = true` auto-derives accounts with PDA seeds
// from the IDL.  However, self-referential PDAs (e.g., a role PDA whose seed
// is `role.name`) cannot be auto-resolved because the client would need to
// fetch the account data to compute the address, creating a circular dep.
//
// We use `.accountsPartial()` for instructions that reference existing
// on-chain account data in their PDA seeds so we can provide those addresses
// as "hints".  For instructions with only arg-based or const seeds
// (initialize, createRole, createPermission), `.accounts()` works fine.
// ────────────────────────────────────────────────────────────────────────────

describe("RBAC On-Chain Engine — Hospital Records", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.rbac as Program<Rbac>;
  const admin = provider.wallet;

  // Users (keypairs to simulate different hospital staff)
  const doctorKeypair = Keypair.generate();
  const nurseKeypair = Keypair.generate();
  const patientKeypair = Keypair.generate();
  const unauthorizedKeypair = Keypair.generate();
  const newAdminKeypair = Keypair.generate();

  // Role names
  const DOCTOR_ROLE = "doctor";
  const NURSE_ROLE = "nurse";
  const ADMIN_ROLE = "admin";
  const PATIENT_ROLE = "patient";

  // Permission names
  const READ_MEDICAL = "read_medical_record";
  const WRITE_MEDICAL = "write_medical_record";
  const UPDATE_RX = "update_prescription";
  const MANAGE_USERS = "manage_users";

  // Derived PDAs
  let rbacState: PublicKey;
  let doctorRole: PublicKey;
  let nurseRole: PublicKey;
  let adminRole: PublicKey;
  let patientRole: PublicKey;
  let readMedicalPerm: PublicKey;
  let writeMedicalPerm: PublicKey;
  let updateRxPerm: PublicKey;
  let manageUsersPerm: PublicKey;

  before(async () => {
    rbacState = rbacStatePda(program.programId);
    doctorRole = rolePda(DOCTOR_ROLE, program.programId);
    nurseRole = rolePda(NURSE_ROLE, program.programId);
    adminRole = rolePda(ADMIN_ROLE, program.programId);
    patientRole = rolePda(PATIENT_ROLE, program.programId);
    readMedicalPerm = permissionPda(READ_MEDICAL, program.programId);
    writeMedicalPerm = permissionPda(WRITE_MEDICAL, program.programId);
    updateRxPerm = permissionPda(UPDATE_RX, program.programId);
    manageUsersPerm = permissionPda(MANAGE_USERS, program.programId);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. INITIALIZATION
  //    rbacState = const seeds → auto-resolved
  //    systemProgram = address → auto-resolved
  //    authority → must pass
  // ──────────────────────────────────────────────────────────────────────

  describe("Initialization", () => {
    it("initializes the RBAC system", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Initialize tx:", tx);

      const state = await program.account.rbacState.fetch(rbacState);
      expect(state.superAdmin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(state.totalRoles.toNumber()).to.equal(0);
      expect(state.totalPermissions.toNumber()).to.equal(0);
    });

    it("prevents double initialization", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            authority: admin.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. ROLE MANAGEMENT
  //    role = arg-based seeds → auto-resolved from method args
  //    Only authority must be passed
  // ──────────────────────────────────────────────────────────────────────

  describe("Role Management", () => {
    it("creates a Doctor role", async () => {
      const tx = await program.methods
        .createRole(DOCTOR_ROLE)
        .accounts({
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Create Doctor role tx:", tx);

      const role = await program.account.role.fetch(doctorRole);
      expect(role.name).to.equal(DOCTOR_ROLE);
      expect(role.createdAt.toNumber()).to.be.greaterThan(0);
    });

    it("creates a Nurse role", async () => {
      const tx = await program.methods
        .createRole(NURSE_ROLE)
        .accounts({
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Create Nurse role tx:", tx);

      const role = await program.account.role.fetch(nurseRole);
      expect(role.name).to.equal(NURSE_ROLE);
    });

    it("creates Admin and Patient roles", async () => {
      await program.methods
        .createRole(ADMIN_ROLE)
        .accounts({ authority: admin.publicKey })
        .rpc();

      await program.methods
        .createRole(PATIENT_ROLE)
        .accounts({ authority: admin.publicKey })
        .rpc();

      const state = await program.account.rbacState.fetch(rbacState);
      expect(state.totalRoles.toNumber()).to.equal(4);

      console.log("  ✅ Created 4 roles total. Counter:", state.totalRoles.toNumber());
    });

    it("rejects duplicate role name", async () => {
      try {
        await program.methods
          .createRole(DOCTOR_ROLE)
          .accounts({ authority: admin.publicKey })
          .rpc();
        expect.fail("Should have thrown — duplicate role");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("rejects role name longer than 32 bytes", async () => {
      const longName = "a".repeat(33);
      try {
        // PDA derivation itself throws for seeds > 32 bytes
        const longRole = rolePda(longName, program.programId);
        await program.methods
          .createRole(longName)
          .accounts({ authority: admin.publicKey })
          .rpc();
        expect.fail("Should have thrown — name too long");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("rejects non-admin creating a role", async () => {
      try {
        await program.methods
          .createRole("hacker_role")
          .accounts({ authority: unauthorizedKeypair.publicKey })
          .signers([unauthorizedKeypair])
          .rpc();
        expect.fail("Should have thrown — unauthorized");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. PERMISSION MANAGEMENT
  //    permission = arg-based seeds → auto-resolved from method args
  //    Only authority must be passed
  // ──────────────────────────────────────────────────────────────────────

  describe("Permission Management", () => {
    it("creates read_medical_record permission", async () => {
      const tx = await program.methods
        .createPermission(READ_MEDICAL, "medical_record", "read")
        .accounts({ authority: admin.publicKey })
        .rpc();

      console.log("  ✅ Create read_medical_record tx:", tx);

      const perm = await program.account.permission.fetch(readMedicalPerm);
      expect(perm.name).to.equal(READ_MEDICAL);
      expect(perm.resource).to.equal("medical_record");
      expect(perm.action).to.equal("read");
    });

    it("creates write_medical_record permission", async () => {
      await program.methods
        .createPermission(WRITE_MEDICAL, "medical_record", "write")
        .accounts({ authority: admin.publicKey })
        .rpc();

      const perm = await program.account.permission.fetch(writeMedicalPerm);
      expect(perm.name).to.equal(WRITE_MEDICAL);
    });

    it("creates update_prescription and manage_users permissions", async () => {
      await program.methods
        .createPermission(UPDATE_RX, "prescription", "update")
        .accounts({ authority: admin.publicKey })
        .rpc();

      await program.methods
        .createPermission(MANAGE_USERS, "users", "manage")
        .accounts({ authority: admin.publicKey })
        .rpc();

      const state = await program.account.rbacState.fetch(rbacState);
      expect(state.totalPermissions.toNumber()).to.equal(4);

      console.log("  ✅ Created 4 permissions total. Counter:", state.totalPermissions.toNumber());
    });

    it("rejects non-admin creating a permission", async () => {
      try {
        await program.methods
          .createPermission("hack_perm", "system", "hack")
          .accounts({ authority: unauthorizedKeypair.publicKey })
          .signers([unauthorizedKeypair])
          .rpc();
        expect.fail("Should have thrown — unauthorized");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. ASSIGN PERMISSIONS TO ROLES
  //    Uses accountsPartial() because role/permission PDAs have
  //    self-referential seeds (role.name, permission.name) that
  //    Anchor can't auto-resolve without knowing the address first.
  // ──────────────────────────────────────────────────────────────────────

  describe("Assign Permissions to Roles", () => {
    it("gives Doctor role: read, write, and prescribe permissions", async () => {
      // Doctor → read_medical_record
      await program.methods
        .assignPermissionToRole()
        .accountsPartial({
          role: doctorRole,
          permission: readMedicalPerm,
          authority: admin.publicKey,
        })
        .rpc();

      // Doctor → write_medical_record
      await program.methods
        .assignPermissionToRole()
        .accountsPartial({
          role: doctorRole,
          permission: writeMedicalPerm,
          authority: admin.publicKey,
        })
        .rpc();

      // Doctor → update_prescription
      await program.methods
        .assignPermissionToRole()
        .accountsPartial({
          role: doctorRole,
          permission: updateRxPerm,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Doctor: read_medical, write_medical, update_prescription");
    });

    it("gives Nurse role: read permission only", async () => {
      await program.methods
        .assignPermissionToRole()
        .accountsPartial({
          role: nurseRole,
          permission: readMedicalPerm,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Nurse: read_medical_record only");
    });

    it("gives Admin role: manage_users permission", async () => {
      await program.methods
        .assignPermissionToRole()
        .accountsPartial({
          role: adminRole,
          permission: manageUsersPerm,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Admin: manage_users");
    });

    it("gives Patient role: read permission only", async () => {
      await program.methods
        .assignPermissionToRole()
        .accountsPartial({
          role: patientRole,
          permission: readMedicalPerm,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Patient: read_medical_record only");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. ASSIGN ROLES TO USERS
  //    accountsPartial() because role has self-referential PDA seeds
  // ──────────────────────────────────────────────────────────────────────

  describe("Assign Roles to Users", () => {
    it("assigns Doctor role to doctor user", async () => {
      const tx = await program.methods
        .assignRoleToUser()
        .accountsPartial({
          role: doctorRole,
          user: doctorKeypair.publicKey,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Doctor user assigned 'doctor' role:", tx);

      const ur = await program.account.userRole.fetch(
        userRolePda(doctorKeypair.publicKey, doctorRole, program.programId)
      );
      expect(ur.user.toBase58()).to.equal(doctorKeypair.publicKey.toBase58());
      expect(ur.role.toBase58()).to.equal(doctorRole.toBase58());
    });

    it("assigns Nurse role to nurse user", async () => {
      await program.methods
        .assignRoleToUser()
        .accountsPartial({
          role: nurseRole,
          user: nurseKeypair.publicKey,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Nurse user assigned 'nurse' role");
    });

    it("assigns Patient role to patient user", async () => {
      await program.methods
        .assignRoleToUser()
        .accountsPartial({
          role: patientRole,
          user: patientKeypair.publicKey,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Patient user assigned 'patient' role");
    });

    it("rejects non-admin assigning a role", async () => {
      try {
        await program.methods
          .assignRoleToUser()
          .accountsPartial({
            role: doctorRole,
            user: unauthorizedKeypair.publicKey,
            authority: unauthorizedKeypair.publicKey,
          })
          .signers([unauthorizedKeypair])
          .rpc();
        expect.fail("Should have thrown — unauthorized");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. ACCESS CHECKS — THE CORE RBAC VERIFICATION
  //    accountsPartial() for all — some PDAs may not exist (denied tests)
  //    and self-referential role/permission PDAs need hints.
  // ──────────────────────────────────────────────────────────────────────

  describe("Access Checks", () => {
    it("Doctor CAN read medical records", async () => {
      const tx = await program.methods
        .checkAccess()
        .accountsPartial({
          user: doctorKeypair.publicKey,
          role: doctorRole,
          permission: readMedicalPerm,
          userRole: userRolePda(doctorKeypair.publicKey, doctorRole, program.programId),
          rolePermission: rolePermissionPda(doctorRole, readMedicalPerm, program.programId),
        })
        .rpc();

      console.log("  ✅ Doctor → read_medical_record: GRANTED", tx);
    });

    it("Doctor CAN write medical records", async () => {
      await program.methods
        .checkAccess()
        .accountsPartial({
          user: doctorKeypair.publicKey,
          role: doctorRole,
          permission: writeMedicalPerm,
          userRole: userRolePda(doctorKeypair.publicKey, doctorRole, program.programId),
          rolePermission: rolePermissionPda(doctorRole, writeMedicalPerm, program.programId),
        })
        .rpc();

      console.log("  ✅ Doctor → write_medical_record: GRANTED");
    });

    it("Doctor CAN update prescriptions", async () => {
      await program.methods
        .checkAccess()
        .accountsPartial({
          user: doctorKeypair.publicKey,
          role: doctorRole,
          permission: updateRxPerm,
          userRole: userRolePda(doctorKeypair.publicKey, doctorRole, program.programId),
          rolePermission: rolePermissionPda(doctorRole, updateRxPerm, program.programId),
        })
        .rpc();

      console.log("  ✅ Doctor → update_prescription: GRANTED");
    });

    it("Nurse CAN read medical records", async () => {
      await program.methods
        .checkAccess()
        .accountsPartial({
          user: nurseKeypair.publicKey,
          role: nurseRole,
          permission: readMedicalPerm,
          userRole: userRolePda(nurseKeypair.publicKey, nurseRole, program.programId),
          rolePermission: rolePermissionPda(nurseRole, readMedicalPerm, program.programId),
        })
        .rpc();

      console.log("  ✅ Nurse → read_medical_record: GRANTED");
    });

    it("Nurse CANNOT write medical records", async () => {
      try {
        await program.methods
          .checkAccess()
          .accountsPartial({
            user: nurseKeypair.publicKey,
            role: nurseRole,
            permission: writeMedicalPerm,
            userRole: userRolePda(nurseKeypair.publicKey, nurseRole, program.programId),
            rolePermission: rolePermissionPda(nurseRole, writeMedicalPerm, program.programId),
          })
          .rpc();
        expect.fail("Should have thrown — nurse has no write permission");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("  ✅ Nurse → write_medical_record: DENIED (as expected)");
      }
    });

    it("Nurse CANNOT update prescriptions", async () => {
      try {
        await program.methods
          .checkAccess()
          .accountsPartial({
            user: nurseKeypair.publicKey,
            role: nurseRole,
            permission: updateRxPerm,
            userRole: userRolePda(nurseKeypair.publicKey, nurseRole, program.programId),
            rolePermission: rolePermissionPda(nurseRole, updateRxPerm, program.programId),
          })
          .rpc();
        expect.fail("Should have thrown — nurse has no prescribe permission");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("  ✅ Nurse → update_prescription: DENIED (as expected)");
      }
    });

    it("Patient CAN read medical records", async () => {
      await program.methods
        .checkAccess()
        .accountsPartial({
          user: patientKeypair.publicKey,
          role: patientRole,
          permission: readMedicalPerm,
          userRole: userRolePda(patientKeypair.publicKey, patientRole, program.programId),
          rolePermission: rolePermissionPda(patientRole, readMedicalPerm, program.programId),
        })
        .rpc();

      console.log("  ✅ Patient → read_medical_record: GRANTED");
    });

    it("Patient CANNOT write medical records", async () => {
      try {
        await program.methods
          .checkAccess()
          .accountsPartial({
            user: patientKeypair.publicKey,
            role: patientRole,
            permission: writeMedicalPerm,
            userRole: userRolePda(patientKeypair.publicKey, patientRole, program.programId),
            rolePermission: rolePermissionPda(patientRole, writeMedicalPerm, program.programId),
          })
          .rpc();
        expect.fail("Should have thrown — patient has no write permission");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("  ✅ Patient → write_medical_record: DENIED (as expected)");
      }
    });

    it("Unassigned user CANNOT access anything", async () => {
      try {
        await program.methods
          .checkAccess()
          .accountsPartial({
            user: unauthorizedKeypair.publicKey,
            role: doctorRole,
            permission: readMedicalPerm,
            userRole: userRolePda(unauthorizedKeypair.publicKey, doctorRole, program.programId),
            rolePermission: rolePermissionPda(doctorRole, readMedicalPerm, program.programId),
          })
          .rpc();
        expect.fail("Should have thrown — user has no role");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("  ✅ Unauthorized user → DENIED (as expected)");
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. REVOCATION
  // ──────────────────────────────────────────────────────────────────────

  describe("Revocation", () => {
    it("revokes read permission from Nurse role", async () => {
      await program.methods
        .revokePermissionFromRole()
        .accountsPartial({
          role: nurseRole,
          permission: readMedicalPerm,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Revoked read_medical from Nurse role");
    });

    it("Nurse can no longer read medical records after revocation", async () => {
      try {
        await program.methods
          .checkAccess()
          .accountsPartial({
            user: nurseKeypair.publicKey,
            role: nurseRole,
            permission: readMedicalPerm,
            userRole: userRolePda(nurseKeypair.publicKey, nurseRole, program.programId),
            rolePermission: rolePermissionPda(nurseRole, readMedicalPerm, program.programId),
          })
          .rpc();
        expect.fail("Should have thrown — permission was revoked");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("  ✅ Nurse → read_medical_record: DENIED after revocation");
      }
    });

    it("revokes Nurse role from nurse user", async () => {
      await program.methods
        .revokeRoleFromUser()
        .accountsPartial({
          role: nurseRole,
          user: nurseKeypair.publicKey,
          authority: admin.publicKey,
        })
        .rpc();

      console.log("  ✅ Revoked 'nurse' role from nurse user");

      // Verify the UserRole account is closed
      const info = await provider.connection.getAccountInfo(
        userRolePda(nurseKeypair.publicKey, nurseRole, program.programId)
      );
      expect(info).to.be.null;
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. SUPER ADMIN TRANSFER
  // ──────────────────────────────────────────────────────────────────────

  describe("Super Admin Transfer", () => {
    it("transfers super admin to a new authority", async () => {
      await program.methods
        .transferSuperAdmin()
        .accountsPartial({
          authority: admin.publicKey,
          newAdmin: newAdminKeypair.publicKey,
        })
        .rpc();

      const state = await program.account.rbacState.fetch(rbacState);
      expect(state.superAdmin.toBase58()).to.equal(newAdminKeypair.publicKey.toBase58());

      console.log("  ✅ Super admin transferred to:", newAdminKeypair.publicKey.toBase58());
    });

    it("old admin can no longer create roles", async () => {
      try {
        await program.methods
          .createRole("forbidden_role")
          .accounts({ authority: admin.publicKey })
          .rpc();
        expect.fail("Should have thrown — old admin is no longer authorized");
      } catch (err: any) {
        expect(err).to.exist;
        console.log("  ✅ Old admin correctly rejected");
      }
    });

    it("transfers super admin back for cleanup", async () => {
      // Fund the new admin via direct transfer (airdrop is rate-limited on devnet)
      const transferIx = anchor.web3.SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: newAdminKeypair.publicKey,
        lamports: 100_000_000, // 0.1 SOL
      });
      const fundTx = new anchor.web3.Transaction().add(transferIx);
      await provider.sendAndConfirm(fundTx);

      await program.methods
        .transferSuperAdmin()
        .accountsPartial({
          authority: newAdminKeypair.publicKey,
          newAdmin: admin.publicKey,
        })
        .signers([newAdminKeypair])
        .rpc();

      const state = await program.account.rbacState.fetch(rbacState);
      expect(state.superAdmin.toBase58()).to.equal(admin.publicKey.toBase58());

      console.log("  ✅ Super admin restored to original");
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. REMOVAL (cleanup)
  // ──────────────────────────────────────────────────────────────────────

  describe("Role & Permission Removal", () => {
    it("removes the Patient role", async () => {
      // First revoke the user's role assignment
      await program.methods
        .revokeRoleFromUser()
        .accountsPartial({
          role: patientRole,
          user: patientKeypair.publicKey,
          authority: admin.publicKey,
        })
        .rpc();

      // Then revoke role-permission link
      await program.methods
        .revokePermissionFromRole()
        .accountsPartial({
          role: patientRole,
          permission: readMedicalPerm,
          authority: admin.publicKey,
        })
        .rpc();

      // Now remove the role
      await program.methods
        .removeRole()
        .accountsPartial({
          role: patientRole,
          authority: admin.publicKey,
        })
        .rpc();

      const info = await provider.connection.getAccountInfo(patientRole);
      expect(info).to.be.null;

      console.log("  ✅ Patient role removed (account closed)");
    });

    it("removes the manage_users permission", async () => {
      // First revoke from admin role
      await program.methods
        .revokePermissionFromRole()
        .accountsPartial({
          role: adminRole,
          permission: manageUsersPerm,
          authority: admin.publicKey,
        })
        .rpc();

      // Then remove
      await program.methods
        .removePermission()
        .accountsPartial({
          permission: manageUsersPerm,
          authority: admin.publicKey,
        })
        .rpc();

      const info = await provider.connection.getAccountInfo(manageUsersPerm);
      expect(info).to.be.null;

      console.log("  ✅ manage_users permission removed (account closed)");
    });
  });
});
