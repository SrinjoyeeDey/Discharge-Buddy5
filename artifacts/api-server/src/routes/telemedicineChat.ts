import { Router, Request, Response } from "express";
import { db } from "../../../lib/db/src";
import { telemedicineSessions, telemedicineMessages } from "../../../lib/db/src/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Start a new telemedicine session
router.post("/start", async (req: Request, res: Response) => {
    try {
        const { patientUserId } = req.body;
        const session = await db.insert(telemedicineSessions).values({
            patientUserId,
            status: "pending",
        }).returning();
        res.json({ success: true, session: session[0] });
    } catch (error) {
        res.status(500).json({ error: "Failed to start session" });
    }
});

// Send a message
router.post("/message", async (req: Request, res: Response) => {
    try {
        const { sessionId, senderId, senderType, message } = req.body;
        const newMessage = await db.insert(telemedicineMessages).values({
            sessionId,
            senderId,
            senderType,
            message,
        }).returning();
        res.json({ success: true, message: newMessage[0] });
    } catch (error) {
        res.status(500).json({ error: "Failed to send message" });
    }
});

// Get session details
router.get("/session/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const session = await db.select().from(telemedicineSessions)
            .where(eq(telemedicineSessions.id, parseInt(id)));
        const messages = await db.select().from(telemedicineMessages)
            .where(eq(telemedicineMessages.sessionId, parseInt(id)));
        res.json({ success: true, session: session[0], messages });
    } catch (error) {
        res.status(500).json({ error: "Failed to get session" });
    }
});

export default router;