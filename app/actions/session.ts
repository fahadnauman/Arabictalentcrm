"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function clockIn() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new Error("Unauthorised");

  const user = await verifyToken(token);
  if (!user || user.role !== "AGENT") throw new Error("Unauthorised");

  // Check if there is an active session
  const activeSession = await prisma.agentSession.findFirst({
    where: {
      agentId: user.id,
      clockOut: null,
    }
  });

  if (activeSession) {
    return { success: false, message: "Already clocked in." };
  }

  await prisma.agentSession.create({
    data: {
      agentId: user.id,
      clockIn: new Date(),
    }
  });

  revalidatePath("/dashboard/agent");
  return { success: true };
}

export async function clockOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new Error("Unauthorised");

  const user = await verifyToken(token);
  if (!user || user.role !== "AGENT") throw new Error("Unauthorised");

  const activeSession = await prisma.agentSession.findFirst({
    where: {
      agentId: user.id,
      clockOut: null,
    },
    orderBy: { clockIn: "desc" }
  });

  if (!activeSession) {
    return { success: false, message: "No active session to clock out of." };
  }

  await prisma.agentSession.update({
    where: { id: activeSession.id },
    data: { clockOut: new Date() }
  });

  revalidatePath("/dashboard/agent");
  return { success: true };
}

export async function getActiveSession(agentId: string) {
  return prisma.agentSession.findFirst({
    where: {
      agentId,
      clockOut: null,
    }
  });
}
