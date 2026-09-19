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

export interface CreateTaskInput {
  title?: string;
  message: string;
  receiverId: string; // specific agentId or "ALL"
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
}

export async function createTask(input: CreateTaskInput) {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized. Please log in to create tasks.");
  }

  if (!input.message || !input.message.trim()) {
    throw new Error("Task message cannot be empty.");
  }

  let isBroadcast = false;
  let targetReceiverId: string | null = null;

  if (user.role === "ADMIN") {
    isBroadcast = input.receiverId === "ALL" || !input.receiverId;
    if (!isBroadcast) {
      const targetAgent = await prisma.user.findUnique({
        where: { id: input.receiverId },
        select: { id: true, role: true, name: true },
      });
      if (!targetAgent) {
        throw new Error("Selected agent does not exist.");
      }
      targetReceiverId = targetAgent.id;
    }
  } else {
    // Counselors assign tasks to themselves
    targetReceiverId = user.id;
    isBroadcast = false;
  }

  const task = await prisma.taskAssignment.create({
    data: {
      title: input.title?.trim() || null,
      message: input.message.trim(),
      priority: input.priority || "MEDIUM",
      status: "PENDING",
      senderId: user.id,
      receiverId: targetReceiverId,
      isBroadcast,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    include: {
      receiver: { select: { id: true, name: true, email: true } },
      sender: { select: { id: true, name: true } },
    },
  });

  // Log in AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: user.role === "ADMIN" ? "task.assigned" : "task.self_assigned",
        entityType: "TaskAssignment",
        entityId: task.id,
        metadata: {
          taskTitle: task.title,
          taskMessage: task.message,
          isBroadcast,
          receiverName: isBroadcast ? "All Agents" : task.receiver?.name || "Self",
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        },
      },
    });
  } catch (logErr) {
    console.warn("Failed to log task audit:", logErr);
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/agent");

  return {
    success: true,
    task: {
      id: task.id,
      title: task.title,
      message: task.message,
      priority: task.priority,
      status: task.status,
      isBroadcast: task.isBroadcast,
      receiverName: isBroadcast ? "All Agents" : task.receiver?.name || "Agent",
      dueDate: task.dueDate,
      createdAt: task.createdAt,
    },
  };
}

export async function getAdminRecentTasks(limit = 8) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") return [];

  const tasks = await prisma.taskAssignment.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      receiver: { select: { id: true, name: true, email: true } },
      sender: { select: { id: true, name: true } },
    },
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    message: t.message,
    priority: t.priority,
    status: t.status,
    isBroadcast: t.isBroadcast,
    receiverName: t.isBroadcast ? "All Agents" : t.receiver?.name || "Agent",
    senderName: t.sender?.name || "Admin",
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  }));
}

export async function getAgentTasks(agentId: string) {
  const user = await getAuthUser();
  if (!user) return [];

  const tasks = await prisma.taskAssignment.findMany({
    where: {
      OR: [
        { receiverId: agentId },
        { isBroadcast: true },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    message: t.message,
    priority: t.priority,
    status: t.status,
    isBroadcast: t.isBroadcast,
    senderName: t.sender?.name || "Admin",
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  }));
}

export async function updateTaskStatus(taskId: string, status: "PENDING" | "IN_PROGRESS" | "COMPLETED") {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorised");

  const task = await prisma.taskAssignment.findUnique({
    where: { id: taskId },
  });

  if (!task) throw new Error("Task not found");

  // Only the assigned agent or an admin can update
  if (user.role !== "ADMIN" && task.receiverId && task.receiverId !== user.id && !task.isBroadcast) {
    throw new Error("Unauthorized to update this task.");
  }

  const updated = await prisma.taskAssignment.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/agent");

  return { success: true, status: updated.status };
}
