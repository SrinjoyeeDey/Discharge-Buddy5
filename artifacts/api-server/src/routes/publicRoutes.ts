import { Router } from "express";
import { db, medicalCards, eq, and } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

/**
 * GET /public/medical-card/:qrHash
 * PUBLIC landing page for emergency responders to view medical card data.
 * This is a simple HTML page (no React, no authentication).
 */
router.get("/medical-card/:qrHash", async (req, res) => {
    try {
        const { qrHash } = req.params;

        if (!qrHash || qrHash.length !== 64) {
            return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid QR Code - Discharge Buddy</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
            .container { max-width: 500px; width: 100%; background: white; border-radius: 20px; padding: 40px 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
            .error-icon { font-size: 60px; margin-bottom: 20px; }
            h1 { color: #1e293b; font-size: 24px; margin-bottom: 10px; }
            p { color: #64748b; font-size: 16px; line-height: 1.6; }
            .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Invalid QR Code</h1>
            <p>This QR code is invalid or expired. Please scan a valid Discharge Buddy medical QR code.</p>
            <div class="footer">Discharge Buddy Medical QR System</div>
          </div>
        </body>
        </html>
      `);
        }

        // Find the medical card by hash
        const [card] = await db
            .select()
            .from(medicalCards)
            .where(and(
                eq(medicalCards.qrCodeHash, qrHash),
                eq(medicalCards.isPublic, true)
            ));

        if (!card) {
            return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Card Not Found - Discharge Buddy</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
            .container { max-width: 500px; width: 100%; background: white; border-radius: 20px; padding: 40px 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
            .error-icon { font-size: 60px; margin-bottom: 20px; }
            h1 { color: #1e293b; font-size: 24px; margin-bottom: 10px; }
            p { color: #64748b; font-size: 16px; line-height: 1.6; }
            .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">🔒</div>
            <h1>Card Not Found</h1>
            <p>This medical card has been disabled or no longer exists. If you need medical information, please contact the patient directly.</p>
            <div class="footer">Discharge Buddy Medical QR System</div>
          </div>
        </body>
        </html>
      `);
        }

        // Update access count
        await db
            .update(medicalCards)
            .set({
                accessedAt: new Date(),
                accessCount: card.accessCount + 1,
            })
            .where(eq(medicalCards.id, card.id))
            .catch(err => logger.error({ err }, "Failed to update access count"));

        // Parse the QR payload
        let cardData: any = {};
        try {
            cardData = JSON.parse(card.qrCodeValue || "{}");
        } catch (e) {
            logger.error({ err: e }, "Failed to parse QR code value");
        }

        // Format medications HTML
        const medicationsHtml = cardData.currentMedications && cardData.currentMedications.length > 0
            ? cardData.currentMedications.map((med: any) => `
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 10px;">
            <div>
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Medication</div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${med.name || "—"}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Dosage</div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${med.dosage || "—"}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Frequency</div>
              <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${med.frequency || "—"}</div>
            </div>
          </div>
        `).join("")
            : '<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 14px;">No active medications</div>';

        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="Emergency Medical Information Card">
        <title>Emergency Medical Card - ${cardData.patientName || "Patient"}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .container {
            max-width: 600px;
            width: 100%;
            background: white;
            border-radius: 24px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
          }

          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            margin: -30px -30px 24px -30px;
            border-radius: 24px 24px 0 0;
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .header-icon {
            font-size: 32px;
            flex-shrink: 0;
          }

          .header-content h1 {
            font-size: 20px;
            margin-bottom: 4px;
          }

          .header-content p {
            font-size: 13px;
            opacity: 0.95;
          }

          .warning-banner {
            background: #fef2f2;
            border: 2px solid #fecaca;
            border-radius: 12px;
            padding: 12px 16px;
            margin-bottom: 24px;
            display: flex;
            gap: 12px;
            align-items: flex-start;
          }

          .warning-banner .icon {
            font-size: 20px;
            flex-shrink: 0;
            margin-top: 2px;
          }

          .warning-banner .text {
            font-size: 13px;
            color: #991b1b;
            line-height: 1.5;
          }

          .section {
            margin-bottom: 28px;
          }

          .section-title {
            font-size: 12px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .section-title .icon {
            font-size: 16px;
          }

          .field {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e2e8f0;
          }

          .field:last-child {
            border-bottom: none;
          }

          .field-label {
            font-size: 12px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }

          .field-value {
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
            text-align: right;
            max-width: 50%;
            word-break: break-word;
          }

          .field-value.highlight {
            color: #e63e3e;
            font-weight: 700;
          }

          .field-value.phone-link {
            color: #0284c7;
            text-decoration: none;
            cursor: pointer;
          }

          .action-button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 24px;
            text-decoration: none;
            display: inline-block;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
          }

          .action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
          }

          .action-button:active {
            transform: translateY(0);
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }

          .footer-text {
            margin-bottom: 8px;
          }

          .timestamp {
            font-size: 11px;
            color: #cbd5e1;
            margin-top: 8px;
          }

          @media print {
            body {
              background: white;
            }
            .container {
              box-shadow: none;
              padding: 0;
              border-radius: 0;
            }
            .action-button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-icon">🏥</div>
            <div class="header-content">
              <h1>Emergency Medical Card</h1>
              <p>For emergency responders only</p>
            </div>
          </div>

          <div class="warning-banner">
            <div class="icon">⚠️</div>
            <div class="text"><strong>Important:</strong> This is critical medical information. Please act in the best interest of the patient.</div>
          </div>

          <!-- Patient Information -->
          <div class="section">
            <div class="section-title">
              <span class="icon">👤</span>
              Patient Information
            </div>
            <div class="field">
              <span class="field-label">Name</span>
              <span class="field-value">${cardData.patientName || "—"}</span>
            </div>
            <div class="field">
              <span class="field-label">Blood Type</span>
              <span class="field-value highlight">${cardData.bloodType || "Unknown"}</span>
            </div>
          </div>

          <!-- Medical Details -->
          <div class="section">
            <div class="section-title">
              <span class="icon">⚕️</span>
              Medical Details
            </div>
            <div class="field">
              <span class="field-label">Allergies</span>
              <span class="field-value highlight">${cardData.allergies || "None reported"}</span>
            </div>
            <div class="field">
              <span class="field-label">Conditions</span>
              <span class="field-value">${cardData.diseases || "See medical records"}</span>
            </div>
          </div>

          <!-- Current Medications -->
          <div class="section">
            <div class="section-title">
              <span class="icon">💊</span>
              Current Medications
            </div>
            ${medicationsHtml}
          </div>

          <!-- Emergency Contact -->
          <div class="section">
            <div class="section-title">
              <span class="icon">📱</span>
              Emergency Contact
            </div>
            <div class="field">
              <span class="field-label">Contact Name</span>
              <span class="field-value">${cardData.emergencyContactName || "Not set"}</span>
            </div>
            <div class="field">
              <span class="field-label">Phone</span>
              <span class="field-value">
                <a href="tel:${cardData.emergencyContactPhone}" class="field-value phone-link">
                  ${cardData.emergencyContactPhone || "Not set"}
                </a>
              </span>
            </div>
          </div>

          <!-- Call Button -->
          ${cardData.emergencyContactPhone ? `
            <a href="tel:${cardData.emergencyContactPhone}" class="action-button">
              📞 Call Emergency Contact
            </a>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            <div class="footer-text">🔐 Discharge Buddy Medical QR System</div>
            <div class="footer-text">For questions about this patient, contact the emergency contact number above.</div>
            <div class="timestamp">Card last accessed: ${card.accessedAt ? new Date(card.accessedAt).toLocaleString() : 'Never'}</div>
          </div>
        </div>
      </body>
      </html>
    `;

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(html);
    } catch (error) {
        logger.error({ err: error }, "GET public medical card failed");
        res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - Discharge Buddy</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
          .container { max-width: 500px; width: 100%; background: white; border-radius: 20px; padding: 40px 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); text-align: center; }
          .error-icon { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #1e293b; font-size: 24px; margin-bottom: 10px; }
          p { color: #64748b; font-size: 16px; line-height: 1.6; }
          .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">🚨</div>
          <h1>Server Error</h1>
          <p>An error occurred while retrieving the medical card. Please try again or contact support.</p>
          <div class="footer">Discharge Buddy Medical QR System</div>
        </div>
      </body>
      </html>
    `);
    }
});

export default router;
