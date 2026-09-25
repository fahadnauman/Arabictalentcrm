import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("🚨 RAW WEBHOOK PAYLOAD PARSE ERROR:", parseErr);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // 1. Aggressive Webhook Logging (dump every incoming event regardless of type)
    console.log("🚨 RAW WEBHOOK PAYLOAD:", JSON.stringify(body, null, 2));

    const payload = body;

    // Evolution API sends events like messages.upsert / MESSAGES_UPSERT, messages.update / MESSAGES_UPDATE, connection.update / CONNECTION_UPDATE, and qrcode.updated
    const rawEvent = (payload.event || payload.type || "").toString().toLowerCase().replace(/[._-]/g, "");

    // Aggressive Status Detection: process any payload containing a status/ack field,
    // even if the top-level event string is missing, undefined, or generic.
    const hasStatus = (obj: any): boolean => {
      if (!obj || typeof obj !== "object") return false;
      if (obj.status !== undefined || obj.ack !== undefined) return true;
      if (obj.update?.status !== undefined || obj.update?.ack !== undefined) return true;
      if (Array.isArray(obj.update) && obj.update.some((u: any) => u && (u.status !== undefined || u.ack !== undefined))) return true;
      if (obj.data) {
        if (obj.data.status !== undefined || obj.data.ack !== undefined) return true;
        if (obj.data.update?.status !== undefined || obj.data.update?.ack !== undefined) return true;
        if (Array.isArray(obj.data)) {
          return obj.data.some((item: any) =>
            item && (
              item.status !== undefined ||
              item.ack !== undefined ||
              item.update?.status !== undefined ||
              item.update?.ack !== undefined ||
              (Array.isArray(item.update) && item.update.some((u: any) => u && (u.status !== undefined || u.ack !== undefined)))
            )
          );
        }
      }
      if (Array.isArray(obj)) {
        return obj.some((item: any) =>
          item && (
            item.status !== undefined ||
            item.ack !== undefined ||
            item.update?.status !== undefined ||
            item.update?.ack !== undefined
          )
        );
      }
      return false;
    };

    const isUpdateEvent = rawEvent === "messagesupdate" || rawEvent === "messageupdate";
    const isUpdate = isUpdateEvent || hasStatus(payload);

    const isUpsert =
      rawEvent === "messagesupsert" ||
      rawEvent === "messageupsert" ||
      (!isUpdate && Boolean(
        payload.message ||
        payload.data?.message ||
        (payload.key && !payload.key.fromMe) ||
        (payload.data?.key && !payload.data.key.fromMe)
      ));

    const isConnectionUpdate =
      rawEvent === "connectionupdate" ||
      payload.event === "connection.update" ||
      payload.type === "connection.update" ||
      rawEvent === "qrcodeupdated" ||
      payload.event === "qrcode.updated";

    // 2. Handle Connection Drops (connection.update / qrcode.updated)
    if (isConnectionUpdate) {
      const connData = payload.data || payload;
      const state = connData.state || connData.connection || connData.status;
      const statusCode = connData.statusCode || connData.statusReason || connData.error;
      const isCloseOrDisconnect =
        state === "close" ||
        state === "refused" ||
        statusCode === 401 ||
        statusCode === 403 ||
        statusCode === 428 ||
        connData.reason === 401;
      const needsQR =
        Boolean(connData.qr || connData.qrcode || rawEvent === "qrcodeupdated" || payload.event === "qrcode.updated");

      if (isCloseOrDisconnect || needsQR) {
        console.error(
          "🚨 [CRITICAL CONNECTION DROP] Evolution API WhatsApp Session Disconnected / Logged Out / Needs QR:",
          JSON.stringify(
            {
              event: payload.event || payload.type,
              instance: payload.instance || connData.instance,
              state,
              statusCode,
              isCloseOrDisconnect,
              needsQR,
              data: connData,
            },
            null,
            2
          )
        );
      } else {
        console.log(
          `ℹ️ [Evolution Webhook] Connection State: ${state || "unknown"} (Status: ${statusCode || "N/A"})`
        );
      }

      return NextResponse.json({ success: true, handled: "connection.update" });
    }

    if (!isUpdate && !isUpsert) {
      console.log(`[Evolution Webhook] Unhandled or ignored event type: ${payload.event || payload.type}`);
      return NextResponse.json({ success: true, handled: false });
    }

    if (isUpdate) {
      // ── Bulletproof extraction: handles array, nested array, single object, or payload itself ──
      let updates: any[] = [];
      if (Array.isArray(payload.data)) {
        updates = payload.data;
      } else if (Array.isArray(payload)) {
        updates = payload;
      } else if (payload.data && typeof payload.data === "object") {
        updates = [payload.data];
      } else {
        updates = [payload];
      }

      for (const updateObj of updates) {
        if (!updateObj) continue;

        const rawSid =
          updateObj.key?.id ||
          updateObj.id ||
          updateObj.messageId ||
          updateObj.keyId ||
          updateObj.update?.key?.id ||
          updateObj.update?.id ||
          payload.key?.id ||
          payload.id ||
          payload.messageId ||
          payload.data?.key?.id ||
          payload.data?.id;

        // Extract ack from all known Evolution API payload shapes:
        // update.status (string), update.ack (int), status (string/int), ack (int)
        const rawAck =
          (Array.isArray(updateObj.update) ? (updateObj.update[0]?.status ?? updateObj.update[0]?.ack) : null) ??
          updateObj.update?.status ??
          updateObj.update?.ack ??
          updateObj.status ??
          updateObj.ack ??
          updateObj.data?.status ??
          updateObj.data?.ack ??
          updateObj.data?.update?.status ??
          updateObj.data?.update?.ack ??
          payload.status ??
          payload.ack ??
          payload.update?.status ??
          payload.update?.ack;

        if (rawAck === undefined || rawAck === null) continue;

        // Map raw ack to integer. Handles both numeric and string formats.
        let ackNum: number | null = null;
        if (typeof rawAck === "number") {
          ackNum = rawAck;
        } else if (typeof rawAck === "string") {
          const parsed = parseInt(rawAck, 10);
          if (!isNaN(parsed)) {
            ackNum = parsed;
          } else {
            // Strict string mapping per Evolution API spec:
            const s = rawAck.toUpperCase().trim();
            if (s === "PENDING" || s === "CLOCK" || s === "QUEUED" || s === "ERROR") ackNum = 0;
            else if (s === "SERVER_ACK" || s === "SENT") ackNum = 1;
            else if (s === "DELIVERY_ACK" || s === "DELIVERED" || s === "DEVICE_ACK") ackNum = 2;
            else if (s === "READ" || s === "READ_ACK" || s === "VIEWED") ackNum = 3;
            else if (s === "PLAYED" || s === "PLAYED_ACK" || s === "AUDIO_PLAYED") ackNum = 4;
          }
        }

        if (ackNum === null) continue;
        const incomingAck = ackNum;

        // Map Evolution API ack to database MessageStatus enum:
        // ack: 0 ➔ QUEUED (Pending / Clock)
        // ack: 1 ➔ SENT (Single grey tick)
        // ack: 2 ➔ DELIVERED (Double grey tick)
        // ack: 3 ➔ READ (Double blue tick)
        // ack: 4 ➔ PLAYED (Double blue tick for voice notes)
        let newStatus: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "PLAYED" | null = null;
        if (ackNum === 0) newStatus = "QUEUED";
        else if (ackNum === 1) newStatus = "SENT";
        else if (ackNum === 2) newStatus = "DELIVERED";
        else if (ackNum === 3) newStatus = "READ";
        else if (ackNum >= 4) newStatus = "PLAYED";

        if (!newStatus) continue;

        // Extract remoteJid from update payload (checking all Evolution payload shapes)
        let remoteJid =
          updateObj.key?.remoteJid ||
          updateObj.remoteJid ||
          updateObj.key?.participant ||
          updateObj.participant ||
          updateObj.update?.key?.remoteJid ||
          updateObj.update?.remoteJid ||
          updateObj.data?.key?.remoteJid ||
          updateObj.data?.remoteJid ||
          updateObj.number ||
          updateObj.from ||
          updateObj.to ||
          payload.data?.key?.remoteJid ||
          payload.data?.remoteJid ||
          payload.data?.number ||
          payload.key?.remoteJid ||
          payload.remoteJid ||
          payload.number ||
          "";

        // If rawSid is a compound key (e.g. true_14632170744@s.whatsapp.net_3EB0...), extract remoteJid
        if (!remoteJid && rawSid && rawSid.includes("@s.whatsapp.net")) {
          const parts = rawSid.split("_");
          for (const p of parts) {
            if (p.includes("@s.whatsapp.net")) {
              remoteJid = p;
              break;
            }
          }
        }

        // Clean phone number from remoteJid (strip @s.whatsapp.net, @g.us, and all non-digits)
        const cleanPhone = remoteJid
          ? remoteJid.replace(/@s\.whatsapp\.net/gi, "").replace(/@g\.us/gi, "").replace(/\D/g, "")
          : "";

        // ── STEP 1: Attempt exact ID match (where: { twilioSid: msgId }) ──
        let modifiedCount = 0;
        const msgId = rawSid;
        if (msgId) {
          const sidCandidates = [msgId];
          if (msgId.includes("_")) {
            const parts = msgId.split("_");
            sidCandidates.push(parts[parts.length - 1]);
          }

          const updateResult = await prisma.message.updateMany({
            where: {
              OR: [
                { twilioSid: { in: sidCandidates } },
                { id: { in: sidCandidates } },
              ],
            },
            data: {
              status: newStatus,
              ...(newStatus === "DELIVERED" || newStatus === "READ" || newStatus === "PLAYED"
                ? { deliveredAt: new Date() }
                : {}),
              ...(newStatus === "READ" || newStatus === "PLAYED"
                ? { readAt: new Date() }
                : {}),
            },
          });
          modifiedCount = updateResult.count;
          console.log(`[Evolution Webhook] updateMany twilioSid=${msgId} → ${newStatus} (modified: ${modifiedCount}, ack: ${ackNum})`);
        }

        // ── STEP 2: The 'Blind' Tick Update (Forced fallback when exact ID modifies 0 records) ──
        if (modifiedCount === 0 && cleanPhone) {
          console.log(`[Evolution Webhook] Exact ID match modified 0 records. Initiating forced blind tick update for phone: ${cleanPhone}`);

          const last8 = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;
          const last9 = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;
          const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

          const latestMsg = await prisma.message.findFirst({
            where: {
              lead: {
                OR: [
                  { phone: { contains: cleanPhone } },
                  { phone: { contains: last10 } },
                  { phone: { contains: last9 } },
                  { phone: { contains: last8 } },
                  { phone: cleanPhone },
                  { phone: `+${cleanPhone}` },
                ],
              },
              direction: "OUTBOUND",
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              status: true,
              deliveredAt: true,
              readAt: true,
              twilioSid: true,
              lead: { select: { phone: true } },
            },
          });

          if (latestMsg) {
            await prisma.message.update({
              where: { id: latestMsg.id },
              data: {
                status: newStatus,
                ...(newStatus === "DELIVERED" || newStatus === "READ" || newStatus === "PLAYED"
                  ? { deliveredAt: latestMsg.deliveredAt ?? new Date() }
                  : {}),
                ...(newStatus === "READ" || newStatus === "PLAYED"
                  ? { readAt: latestMsg.readAt ?? new Date() }
                  : {}),
                ...(msgId && !latestMsg.twilioSid ? { twilioSid: msgId } : {}),
              },
            });
            console.log(`[Evolution Webhook] Blind Tick Update SUCCESS: Updated latest outbound message ${latestMsg.id} for phone ${cleanPhone} to ${newStatus}`);
          } else {
            console.warn(`[Evolution Webhook] Blind Tick Update: No outbound message found for phone ${cleanPhone}`);
          }
        }

        console.log("🚨 TICK SYNC:", cleanPhone || "unknown", incomingAck, newStatus);
      }
      return NextResponse.json({ success: true });
    }

    let data = payload.data;
    
    // Evolution API sometimes sends data as an array
    if (Array.isArray(data)) {
      data = data[0];
    }
    
    // In Evolution API v2, the message is often nested under data.message
    const messageData = data?.message?.key ? data.message : data;

    if (!messageData || !messageData.key || messageData.key.fromMe) {
      // Ignore our own outbound messages or malformed payloads
      return NextResponse.json({ success: true });
    }

    const remoteJid = messageData.key.remoteJid;
    if (!remoteJid || remoteJid.includes("@g.us")) {
      // Ignore group messages for now
      return NextResponse.json({ success: true });
    }

    // Clean phone number
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("+", "");
    const messageSid = messageData.key.id;
    const profileName = messageData.pushName || "Unknown WhatsApp User";

    // Extract text body or media caption
    let messageText = "";
    if (messageData.message?.conversation) {
      messageText = messageData.message.conversation;
    } else if (messageData.message?.extendedTextMessage?.text) {
      messageText = messageData.message.extendedTextMessage.text;
    } else if (messageData.message?.imageMessage?.caption) {
      messageText = messageData.message.imageMessage.caption;
    } else if (messageData.message?.videoMessage?.caption) {
      messageText = messageData.message.videoMessage.caption;
    } else if (messageData.message?.documentMessage?.caption) {
      messageText = messageData.message.documentMessage.caption;
    }

    // Media handling
    const messageType = messageData.messageType || Object.keys(messageData.message || {})[0];
    let mediaUrl = null;
    let mediaType = null;
    let rawPayload: any = null;

    if (
      messageType === "imageMessage" ||
      messageType === "videoMessage" ||
      messageType === "audioMessage" ||
      messageType === "documentMessage" ||
      messageType?.includes("image") ||
      messageType?.includes("audio") ||
      messageType?.includes("video") ||
      messageType?.includes("document")
    ) {
      const msgObj = messageData.message?.[messageType] || {};
      const mime = msgObj.mimetype || (
        messageType.includes("image") ? "image/jpeg" :
        messageType.includes("audio") ? "audio/ogg; codecs=opus" :
        messageType.includes("video") ? "video/mp4" :
        "application/pdf"
      );
      mediaType = mime;

      if (!messageText) messageText = "Media Attachment";

      // Extract base64 if provided by Evolution API webhook (with webhookBase64: true)
      const base64Data = 
        payload.data?.base64 || 
        messageData.base64 || 
        msgObj.base64 || 
        payload.base64;

      if (base64Data) {
        rawPayload = {
          type: "attachment",
          base64: base64Data,
          message: messageData
        };
      } else {
        rawPayload = {
          type: "attachment",
          message: messageData
        };
      }
    }

    // 1. Match the clean phone number against the Prisma lead table
    let isNewLead = false;
    let lead = await prisma.lead.findUnique({
      where: { phone },
    });

    if (!lead) {
      isNewLead = true;
      // If the lead doesn't exist, create a new one to log the message against
      const { getNextAgentInRotation, extractCampaignLanguage } = await import("@/lib/roundRobin");
      
      const requiredLang = extractCampaignLanguage("", messageText, profileName);
      const assignment = await getNextAgentInRotation(requiredLang);
      const assignedAgentId = assignment?.agentId || null;

      lead = await prisma.lead.create({
        data: {
          name: profileName,
          phone,
          status: "NEW_LEAD",
          source: "whatsapp",
          assignedAgentId,
          firstAssignedAt: assignedAgentId ? new Date() : null,
        }
      });

      // Log assignment
      if (assignment) {
        await prisma.leadAssignment.create({
          data: {
            leadId:       lead.id,
            assignedToId: assignment.agentId,
            assignedBy:   "round_robin_evolution",
          },
        });
      }
    }

    // 2. Log the incoming message to the lead's timeline
    await prisma.message.upsert({
      where: { twilioSid: messageSid },
      update: {}, // Prevent duplicate processing
      create: {
        twilioSid: messageSid,
        leadId: lead.id,
        body: messageText,
        direction: "INBOUND",
        status: "RECEIVED",
        mediaUrl,
        mediaType,
        rawPayload,
      }
    });

    // 3. Sunday / Out of Office Auto-Responder check for newly created leads
    if (isNewLead) {
      try {
        const now = new Date();
        const gstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
        const dayOfWeek = gstDate.getDay(); // 0 = Sunday
        const hour = gstDate.getHours();    // 0 - 23

        // Trigger if Sunday or outside configured working hours (09:00 - 19:00 GST)
        const isSunday = dayOfWeek === 0;
        const isOffHours = hour < 9 || hour >= 19;

        if (isSunday || isOffHours) {
          const reasonText = isSunday
            ? "today is Sunday"
            : "outside our regular business hours: 9:00 AM – 7:00 PM GST";
          const autoReplyText = `Thank you for contacting Arabic Talent! Our admissions office is currently closed (${reasonText}). Your inquiry has been safely received, and our academic counselor will reach out to you first thing on the next business day.`;

          const evoUrl = process.env.EVO_API_URL || "http://143.198.182.24:8080";
          const evoKey = process.env.EVO_API_KEY || "arabictalent-api-key-2024";
          const evoInstance = process.env.EVO_INSTANCE || "arabic-talent-prod";

          // Dispatch automatic WhatsApp reply via Evolution API
          const sendRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": evoKey,
            },
            body: JSON.stringify({
              number: phone,
              options: { delay: 1000, presence: "composing" },
              text: autoReplyText,
            }),
          });

          if (sendRes.ok) {
            // Log outbound auto-responder message to lead timeline
            await prisma.message.create({
              data: {
                leadId: lead.id,
                body: autoReplyText,
                direction: "OUTBOUND",
                status: "SENT",
                sentById: null,
              },
            });
          } else {
            console.warn("Evolution API auto-responder dispatch returned status:", sendRes.status);
          }
        }
      } catch (autoErr) {
        console.error("Error in out-of-office auto-responder:", autoErr);
      }
    }

    // 4. Return 200 OK JSON response
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CRITICAL] Evolution Webhook Error:", error);
    // Evolution API expects 200 OK even if we fail, to avoid retrying endlessly, 
    // but 500 is good for debugging.
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "online", webhook: "evolution" });
}
