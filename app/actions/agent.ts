"use server";

import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function getUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export interface CreateAgentInput {
  name:          string;
  email:         string;
  password?:     string;
  phone:         string;
  isActive:      boolean;
  languageGroup: string;
}

export async function createAgent(data: CreateAgentInput) {
  const admin = await getUser();
  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Unauthorized. Only admins can create agents.");
  }

  // Use provided password or fallback to random generated password
  const plainPassword = (data.password || "").trim() || crypto.randomBytes(6).toString("hex");
  if (plainPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  // Securely hash incoming password with bcrypt
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // Generate default avatar (initials on a neon green background)
  const initials = data.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=20C997&color=fff&bold=true`;

  try {
    const newAgent = await prisma.$transaction(async (tx) => {
      // Create User
      const user = await tx.user.create({
        data: {
          name:          data.name.trim(),
          email:         data.email.trim().toLowerCase(),
          phone:         data.phone?.trim() || null,
          passwordHash:  passwordHash,
          avatarUrl:     avatarUrl,
          role:          "AGENT",
          isActive:      data.isActive,
          languageGroup: data.languageGroup || "ENGLISH",
        }
      });

      // Get max position in RR queue to place them at the end
      const maxPosResult = await tx.roundRobinQueue.aggregate({
        _max: { position: true }
      });
      const nextPos = (maxPosResult._max.position || 0) + 1;

      // Add to Round Robin Queue
      await tx.roundRobinQueue.create({
        data: {
          agentId:  user.id,
          position: nextPos,
          isActive: data.isActive,
        }
      });

      return user;
    });

    return { 
      success: true, 
      agentId: newAgent.id, 
      email: newAgent.email,
      tempPassword: plainPassword,
      password: plainPassword,
    };
  } catch (error: any) {
    console.error("Agent creation failed:", error);
    if (error.code === 'P2002') {
      throw new Error("An agent with this email already exists.");
    }
    throw new Error("Failed to create agent. Please try again.");
  }
}

export async function toggleAgentStatus(agentId: string, isActive: boolean) {
  const admin = await getUser();
  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Unauthorized.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: agentId },
      data: { isActive },
    }),
    prisma.roundRobinQueue.updateMany({
      where: { agentId },
      data: { isActive },
    })
  ]);

  return { success: true };
}

export interface UpdateAgentInput {
  agentId:       string;
  name:          string;
  email:         string;
  password?:     string;
  phone?:        string;
  languageGroup?: string;
  isActive?:      boolean;
}

export async function updateAgentProfile(data: UpdateAgentInput) {
  const admin = await getUser();
  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Unauthorized. Only admins can modify agent profiles.");
  }

  const { agentId } = data;
  if (!agentId) {
    throw new Error("Agent ID is required.");
  }

  // 1. Verify agent exists
  const existingAgent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!existingAgent || existingAgent.role !== "AGENT") {
    throw new Error("Agent not found.");
  }

  const normalizedEmail = data.email.trim().toLowerCase();

  // 2. If email is being changed, ensure no collision with another user
  if (normalizedEmail !== existingAgent.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (emailConflict && emailConflict.id !== agentId) {
      throw new Error("Another user already exists with this email address.");
    }
  }

  // 3. Prepare updated data payload strictly keyed by unique id
  const updateData: {
    name: string;
    email: string;
    phone: string | null;
    passwordHash?: string;
    languageGroup?: string;
    isActive?: boolean;
    avatarUrl?: string;
  } = {
    name: data.name.trim(),
    email: normalizedEmail,
    phone: data.phone?.trim() || null,
  };

  if (data.languageGroup) {
    updateData.languageGroup = data.languageGroup;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  // If password provided, validate and hash
  if (data.password && data.password.trim()) {
    const plain = data.password.trim();
    if (plain.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    updateData.passwordHash = await bcrypt.hash(plain, 10);
  }

  // Update initials on avatar if name changed
  const initials = data.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  updateData.avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=20C997&color=fff&bold=true`;

  try {
    const updatedAgent = await prisma.$transaction(async (tx) => {
      // 4. Update the user strictly by ID (preserves all foreign key relations: assignedLeads, messages, auditLogs, etc.)
      const user = await tx.user.update({
        where: { id: agentId },
        data: updateData,
      });

      // 5. Keep round-robin queue slot in sync
      await tx.roundRobinQueue.upsert({
        where: { agentId },
        create: {
          agentId,
          position: 0,
          isActive: data.isActive !== undefined ? data.isActive : user.isActive,
        },
        update: {
          isActive: data.isActive !== undefined ? data.isActive : user.isActive,
        },
      });

      return user;
    });

    return {
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        email: updatedAgent.email,
        languageGroup: updatedAgent.languageGroup,
        isActive: updatedAgent.isActive,
        phone: updatedAgent.phone,
      },
    };
  } catch (err: any) {
    console.error("Failed to update agent profile:", err);
    throw new Error(err.message || "Failed to update agent profile.");
  }
}
