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
  name:     string;
  email:    string;
  phone:    string;
  isActive: boolean;
}

export async function createAgent(data: CreateAgentInput) {
  const admin = await getUser();
  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Unauthorized. Only admins can create agents.");
  }

  // Generate a random temporary password
  const tempPassword = crypto.randomBytes(6).toString("hex"); // e.g. a1b2c3d4e5f6
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // Generate default avatar (initials on a neon green background)
  const initials = data.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const avatarUrl = `https://ui-avatars.com/api/?name=${initials}&background=20C997&color=fff&bold=true`;

  try {
    const newAgent = await prisma.$transaction(async (tx) => {
      // Create User
      const user = await tx.user.create({
        data: {
          name:         data.name,
          email:        data.email,
          passwordHash: passwordHash,
          avatarUrl:    avatarUrl,
          role:         "AGENT",
          isActive:     data.isActive,
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
      tempPassword 
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
