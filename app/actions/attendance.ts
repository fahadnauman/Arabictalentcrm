"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function agentClockIn() {
  const user = await getAuthUser();
  if (!user || user.role !== "AGENT") throw new Error("Unauthorized");

  // Check if there is an ongoing unclosed attendance
  const active = await prisma.attendance.findFirst({
    where: {
      agentId: user.id,
      status: { in: ["CLOCKED_IN", "ON_BREAK"] },
    },
    orderBy: { clockIn: "desc" },
  });

  if (active) {
    return { success: false, message: "Already clocked in.", attendance: active };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newAttendance = await prisma.attendance.create({
    data: {
      agentId: user.id,
      date: today,
      clockIn: new Date(),
      status: "CLOCKED_IN",
    },
  });

  // Legacy sync with AgentSession for backwards compatibility
  try {
    await prisma.agentSession.create({
      data: {
        agentId: user.id,
        clockIn: new Date(),
      },
    });
  } catch (err) {
    console.warn("Session sync notice:", err);
  }

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/admin");

  return { success: true, attendance: newAttendance };
}

export async function agentStartBreak() {
  const user = await getAuthUser();
  if (!user || user.role !== "AGENT") throw new Error("Unauthorized");

  const active = await prisma.attendance.findFirst({
    where: {
      agentId: user.id,
      status: "CLOCKED_IN",
    },
    orderBy: { clockIn: "desc" },
  });

  if (!active) {
    throw new Error("Cannot take break. You must clock in first.");
  }

  const updated = await prisma.attendance.update({
    where: { id: active.id },
    data: {
      status: "ON_BREAK",
      breakStart: new Date(),
    },
  });

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/admin");

  return { success: true, attendance: updated };
}

export async function agentEndBreak() {
  const user = await getAuthUser();
  if (!user || user.role !== "AGENT") throw new Error("Unauthorized");

  const active = await prisma.attendance.findFirst({
    where: {
      agentId: user.id,
      status: "ON_BREAK",
    },
    orderBy: { clockIn: "desc" },
  });

  if (!active || !active.breakStart) {
    throw new Error("No active break to resume from.");
  }

  const breakDurationMins = Math.max(
    1,
    Math.round((Date.now() - new Date(active.breakStart).getTime()) / 60000)
  );

  const updated = await prisma.attendance.update({
    where: { id: active.id },
    data: {
      status: "CLOCKED_IN",
      breakEnd: new Date(),
      totalBreakMinutes: active.totalBreakMinutes + breakDurationMins,
      breakStart: null,
    },
  });

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/admin");

  return { success: true, attendance: updated };
}

export async function agentClockOut() {
  const user = await getAuthUser();
  if (!user || user.role !== "AGENT") throw new Error("Unauthorized");

  const active = await prisma.attendance.findFirst({
    where: {
      agentId: user.id,
      status: { in: ["CLOCKED_IN", "ON_BREAK"] },
    },
    orderBy: { clockIn: "desc" },
  });

  if (!active) {
    return { success: false, message: "No active attendance session found." };
  }

  let finalBreakMins = active.totalBreakMinutes;
  if (active.status === "ON_BREAK" && active.breakStart) {
    finalBreakMins += Math.max(
      1,
      Math.round((Date.now() - new Date(active.breakStart).getTime()) / 60000)
    );
  }

  const totalShiftMins = Math.max(
    1,
    Math.round((Date.now() - new Date(active.clockIn).getTime()) / 60000)
  );
  const totalWorkMins = Math.max(0, totalShiftMins - finalBreakMins);

  const updated = await prisma.attendance.update({
    where: { id: active.id },
    data: {
      status: "CLOCKED_OUT",
      clockOut: new Date(),
      breakStart: null,
      breakEnd: active.status === "ON_BREAK" ? new Date() : active.breakEnd,
      totalBreakMinutes: finalBreakMins,
      totalWorkMinutes: totalWorkMins,
    },
  });

  // Legacy sync with AgentSession
  try {
    const activeSession = await prisma.agentSession.findFirst({
      where: { agentId: user.id, clockOut: null },
      orderBy: { clockIn: "desc" },
    });
    if (activeSession) {
      await prisma.agentSession.update({
        where: { id: activeSession.id },
        data: { clockOut: new Date() },
      });
    }
  } catch (err) {
    console.warn("Session sync notice:", err);
  }

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/admin");

  return { success: true, attendance: updated };
}

export async function getAgentTodayAttendance(agentId: string) {
  return prisma.attendance.findFirst({
    where: {
      agentId,
      status: { in: ["CLOCKED_IN", "ON_BREAK"] },
    },
    orderBy: { clockIn: "desc" },
  });
}

export async function getAdminAttendanceLogs(limit = 20) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") return [];

  const logs = await prisma.attendance.findMany({
    orderBy: { clockIn: "desc" },
    take: limit,
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          languageGroup: true,
        },
      },
    },
  });

  return logs.map((log) => {
    let currentWorkMins = log.totalWorkMinutes;
    let currentBreakMins = log.totalBreakMinutes;

    // If currently active, compute live elapsed minutes
    if (log.status === "CLOCKED_IN" || log.status === "ON_BREAK") {
      if (log.status === "ON_BREAK" && log.breakStart) {
        currentBreakMins += Math.max(
          0,
          Math.round((Date.now() - new Date(log.breakStart).getTime()) / 60000)
        );
      }
      const totalShift = Math.max(
        0,
        Math.round((Date.now() - new Date(log.clockIn).getTime()) / 60000)
      );
      currentWorkMins = Math.max(0, totalShift - currentBreakMins);
    }

    return {
      id: log.id,
      agentId: log.agent.id,
      agentName: log.agent.name,
      agentEmail: log.agent.email,
      agentAvatar: log.agent.avatarUrl,
      languageGroup: log.agent.languageGroup,
      date: log.date,
      clockIn: log.clockIn,
      clockOut: log.clockOut,
      breakStart: log.breakStart,
      breakEnd: log.breakEnd,
      status: log.status,
      totalBreakMinutes: currentBreakMins,
      totalWorkMinutes: currentWorkMins,
      formattedHours: (currentWorkMins / 60).toFixed(1) + "h",
      formattedBreak: currentBreakMins > 0 ? `${currentBreakMins}m` : "0m",
    };
  });
}
