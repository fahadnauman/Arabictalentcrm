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
