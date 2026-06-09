# Medical QR Emergency Card Feature

## Overview
The Medical QR Emergency Card is a critical safety feature that enables emergency responders to instantly access a patient's vital medical information by scanning a QR code, without requiring any authentication or login.

## Architecture

### 1. Database Schema (`medical_cards` table)

**Table Structure:**
```sql
CREATE TABLE medical_cards (
  id UUID PRIMARY KEY,
  patient_id UUID UNIQUE NOT NULL,         -- Links to patients table
  user_id UUID NOT NULL,                   -- Links to users table
  blood_type TEXT,                         -- O+, A-, etc.
  allergies TEXT,                          -- Comma-separated or freeform
  diseases TEXT,                           -- Medical conditions
  current_medications JSONB,               -- Array of { name, dosage, frequency }
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  qr_code_value TEXT,                      -- JSON payload that QR encodes
  qr_code_hash VARCHAR(64) UNIQUE,         -- SHA256 hash for public lookups
  is_public BOOLEAN DEFAULT true,
  accessed_at TIMESTAMP,                   -- Last time scanned
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**Key Features:**
- One medical card per patient (enforced by `patient_id` unique constraint)
- QR code hash is unique for secure public lookups
- Access tracking for audit trail

### 2. QR Code Encoding

**QR Payload Structure:**
```json
{
  "type": "medical_card",
  "patientId": "uuid-here",
  "patientName": "John Doe",
  "bloodType": "O+",
  "allergies": "Penicillin, Nuts",
  "diseases": "Diabetes, Hypertension",
  "currentMedications": [
    {
      "name": "Metformin",
      "dosage": "500mg",
      "frequency": "Twice daily"
    }
  ],
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1-555-0000",
  "createdAt": "2024-12-10T10:30:00Z",
  "checksum": "sha256_hash_for_verification"
}
```

**Why this structure:**
- Self-contained: All information is within the QR code itself
- Hashable: QR payload is hashed for secure public lookups
- Verifiable: Checksum prevents tampering
- Minimal: Optimized for QR code size

### 3. Backend API Endpoints

#### `GET /api/medical-card` (Authenticated)
Retrieves the authenticated user's medical card.
- **Auth**: Required
- **Returns**: Medical card object with latest data
- **Auto-creates**: Card is created on first access if it doesn't exist

```typescript
interface MedicalCard {
  id: string;
  patientId: string;
  userId: string;
  bloodType?: string;
  allergies?: string;
  diseases?: string;
  currentMedications?: Array<{ name: string; dosage: string; frequency: string }>;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  qrCodeValue?: string;                    // JSON string
  isPublic: boolean;
  accessedAt?: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}
```

#### `POST /api/medical-card` (Authenticated)
Creates or updates a medical card with new data.
- **Auth**: Required
- **Body**: Medical card data fields
- **Returns**: Updated card object
- **Behavior**: 
  - Updates medicines list from active medicines in database
  - Regenerates QR payload and hash
  - Uses `onConflictDoUpdate` for upsert

```typescript
interface SaveMedicalCardRequest {
  bloodType: string;
  allergies?: string;
  diseases?: string;
  emergencyContactName?: string;
  emergencyContactPhone: string;
}
```

#### `POST /api/medical-card/regenerate` (Authenticated)
Regenerates the QR code hash (old code stops working).
- **Auth**: Required
- **Body**: Empty
- **Returns**: Updated card with new hash
- **Use Case**: If QR code is compromised or lost

#### `DELETE /api/medical-card` (Authenticated)
Disables the medical card (emergency responders can't scan anymore).
- **Auth**: Required
- **Behavior**: Sets `is_public = false`
- **Recovery**: Can be re-enabled by updating the card again

#### `GET /public/medical-card/:qrHash` (Public)
**⚠️ NO AUTHENTICATION REQUIRED**
This is the endpoint emergency responders access by scanning the QR code.
- **Auth**: None
- **Returns**: HTML page with formatted medical information
- **Features**:
  - Clean, readable design optimized for mobile
  - Call emergency contact with one tap
  - Access tracking (logs every scan)
  - Print-friendly layout
  - Mobile-responsive

**Example Response HTML:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Emergency Medical Card - John Doe</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div class="container">
    <h1>🏥 Emergency Medical Card</h1>
    <div class="warning">Show this to emergency responders only</div>
    <div class="section">
      <h2>Blood Type: O+</h2>
      <h2>Allergies: Penicillin, Nuts</h2>
      <!-- etc -->
    </div>
  </div>
</body>
</html>
```

### 4. Frontend Components

#### `MedicalCardScreen` (`app/medical-card.tsx`)
Main screen for patients to manage their medical card.

**Features:**
1. **View Mode**: Display current card data
2. **Edit Mode**: Update medical information
3. **QR Code Display**: Shows visual QR code
4. **Download QR**: Save QR code as image
5. **Share Link**: Share public link with family
6. **Regenerate QR**: Create new hash for old code
7. **Disable Card**: Stop public access
8. **Access Stats**: See who has viewed the card

**Components Used:**
- `QRCode` from `react-native-qrcode-svg` for QR generation
- `LinearGradient` for visual hierarchy
- Custom `EditField` and `InfoRow` components for data display

#### Navigation Integration
Added to profile screen with prominent red button:
```typescript
<TouchableOpacity
  onPress={() => router.push("/medical-card")}
>
  <Text>Medical Emergency Card</Text>
  <Text>QR code for emergency responders</Text>
</TouchableOpacity>
```

### 5. API Client Methods (`ApiProvider`)

```typescript
// Get current medical card
async getMedicalCard(): Promise<MedicalCard>

// Save/update medical card
async saveMedicalCard(data: {
  bloodType: string;
  allergies?: string;
  diseases?: string;
  emergencyContactName?: string;
  emergencyContactPhone: string;
}): Promise<MedicalCard>

// Regenerate QR code hash
async regenerateMedicalCardQR(): Promise<MedicalCard>

// Disable medical card
async deleteMedicalCard(): Promise<void>
```

## Security Considerations

### 1. No Authentication on Public Route
The `/public/medical-card/:qrHash` endpoint intentionally **does NOT require authentication**. This is a security/design decision:

**Why:**
- Emergency responders may not have app access
- QR code serves as the bearer credential
- Hash-based access prevents guessing (256-bit SHA256)

**Mitigations:**
- QR codes are unique per patient (1:1 relation)
- Hash is cryptographically secure
- Patient can regenerate/disable code anytime
- Access is logged for audit trail
- Public page doesn't leak PII beyond what's on the card

### 2. Data Privacy
- Only publicly-approved medical information is shared
- Patient controls what information is visible
- Emergency-contact phone is plaintext (intentional for responder accessibility)
- Access count allows patients to monitor scans

### 3. QR Code Security
- QR codes encode a hash-based lookup, not direct PII
- Old codes can be invalidated by regenerating
- Checksum in payload helps verify integrity
- Can be disabled entirely if compromised

## Usage Flow

### Patient: Create/Update Medical Card

```
1. User navigates to profile screen
2. Taps "Medical Emergency Card" button
3. Redirected to /medical-card screen
4. Taps "Edit" button
5. Fills in:
   - Blood type (required)
   - Allergies
   - Medical conditions
   - Emergency contact name
   - Emergency contact phone (required)
6. Taps "Save"
7. System:
   - Fetches active medicines from database
   - Generates QR payload with all data
   - Creates SHA256 hash of payload
   - Stores in medical_cards table
8. User can now:
   - View QR code
   - Download QR as PNG
   - Share public link
   - View access statistics
```

### Emergency Responder: Access Medical Information

```
1. Responder scans QR code with any phone camera
2. QR decodes to: https://app.discharge-buddy.com/public/medical-card/{qrHash}
3. Browser navigates to public endpoint
4. Server:
   - Looks up medical card by hash
   - Checks is_public flag
   - Increments access_count
   - Returns formatted HTML
5. Responder sees:
   - Patient name and blood type (highlighted in red)
   - Allergies (highlighted as danger)
   - Current conditions
   - Current medications with dosages
   - Emergency contact name and phone
   - One-tap call button
6. Responder can:
   - Read information clearly
   - Call emergency contact immediately
   - Print page for medical records
```

## Database Migration

To add this feature to existing database:

```bash
# 1. Add the medical_cards table
pnpm run drizzle-kit push

# 2. (Optional) Backfill medical cards for existing patients
# Create a script that:
# - For each patient with linkedPatientId:
#   - Get their user profile
#   - Create medical_card entry with current data
#   - Generate QR payload and hash
#   - Insert into database
```

## Testing Checklist

### Unit Tests
- [ ] QR payload generation creates valid JSON
- [ ] Hash generation is deterministic
- [ ] API returns correct error codes

### Integration Tests
- [ ] Create card → GET returns same card
- [ ] Update card → Changes are persisted
- [ ] Regenerate → Old hash returns 404
- [ ] Delete → is_public=false prevents access

### E2E Tests
- [ ] Patient creates card
- [ ] QR code displays correctly
- [ ] QR code can be downloaded
- [ ] Responder scans QR
- [ ] Public page displays correctly
- [ ] Public page is mobile-responsive
- [ ] Access count increments
- [ ] Call button works (tel: link)

### Security Tests
- [ ] Public endpoint doesn't leak other cards
- [ ] Hash brute-force is impractical
- [ ] Disabled cards return 404
- [ ] Access tracking is accurate

## Troubleshooting

### QR Code Not Displaying
- Check if `react-native-qrcode-svg` is installed
- Verify QR payload is not too large (QR codes have size limits)
- Check browser console for errors

### Public Page Not Loading
- Verify backend is running with public routes enabled
- Check QR hash format (should be 64 hex characters)
- Check database for medical_cards entry

### Access Count Not Updating
- Verify database permissions
- Check for database connection errors
- Look for SQL constraint violations

## Future Enhancements

### Phase 2
1. **Biometric Lock**: Require fingerprint to view QR code in app
2. **Temporary Access**: Generate one-time QR codes that expire
3. **Access Logs**: Show detailed history of who/when scanned
4. **Email Alerts**: Notify patient when card is accessed
5. **Caregiver Share**: Allow sharing card access with trusted caregivers

### Phase 3
1. **Multi-language QR Data**: Encode information in multiple languages
2. **Medical Records Integration**: Link to full medical records via public API
3. **Emergency Alert**: Trigger notification to family when QR is scanned
4. **Prescription Attachments**: Include QR codes on prescriptions
5. **Hospital Kiosks**: Display card on kiosk screens with patient verification

## API Response Examples

### GET /api/medical-card (Success)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "patientId": "660e8400-e29b-41d4-a716-446655440000",
  "userId": "770e8400-e29b-41d4-a716-446655440000",
  "bloodType": "O+",
  "allergies": "Penicillin, Shellfish",
  "diseases": "Diabetes Type 2",
  "currentMedications": [
    {
      "name": "Metformin",
      "dosage": "500mg",
      "frequency": "Twice daily"
    },
    {
      "name": "Lisinopril",
      "dosage": "10mg",
      "frequency": "Once daily"
    }
  ],
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1-555-123-4567",
  "qrCodeValue": "{\"type\": \"medical_card\", ...}",
  "isPublic": true,
  "accessedAt": "2024-12-10T14:30:00Z",
  "accessCount": 2,
  "createdAt": "2024-12-09T10:00:00Z",
  "updatedAt": "2024-12-10T12:45:00Z"
}
```

### GET /public/medical-card/:qrHash (Success)
Returns HTML page as shown above.

### GET /public/medical-card/:qrHash (Not Found)
```html
<!DOCTYPE html>
<html>
<body>
  <h1>Card Not Found</h1>
  <p>This medical card has been disabled...</p>
</body>
</html>
```

## Monitoring & Analytics

### Metrics to Track
1. **Creation Rate**: How many patients create cards
2. **Access Rate**: How many times cards are accessed
3. **Average Access Time**: How quickly responders scan
4. **Error Rate**: Failed card lookups
5. **Feature Adoption**: % of patients with active cards

### Logging
All accesses to public medical cards are logged:
```
[medicalCard] Access - patientId: {id}, hash: {hash}, count: {n}
```

## References

- [QR Code Standards](https://www.qr-code.co.uk)
- [HIPAA Compliance](https://www.hhs.gov/hipaa/for-professionals/index.html)
- [React Native QR Code](https://github.com/awesomedev82/react-native-qrcode-svg)
- [Drizzle ORM Docs](https://orm.drizzle.team)
