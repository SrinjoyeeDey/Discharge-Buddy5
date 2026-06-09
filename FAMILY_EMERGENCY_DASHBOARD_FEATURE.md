# Feature #25: Family Emergency Dashboard

## Overview

The **Family Emergency Dashboard** feature enables patients to invite family members to view real-time emergency status updates, and allows family members to monitor patient recovery progress and health status remotely. This creates a bridge between hospitalized/recovering patients and their loved ones, reducing anxiety and enabling informed emergency decision-making.

## Business Requirements

### 1. Patient-Family Linking (`POST /api/family/link`)
- **Actor**: Patient  
- **Flow**: 
  - Patient enters family member's email address
  - System searches for user with that email
  - Creates a `familyLinks` record with status `pending`
  - Sends invitation email to family member
- **Validation**: 
  - Email must be registered in the system
  - Can't link to self
  - Can't create duplicate links
- **Response**: Link ID, status, and confirmation message

### 2. Invitation Response (`POST /api/family/link/:linkId/accept` / `reject`)
- **Actor**: Invited family member
- **Actions**:
  - Accept: Updates status to `accepted`, sets `acceptedAt` timestamp
  - Reject: Updates status to `rejected`
- **Authorization**: Only the invited family member can accept/reject

### 3. Patient Status Dashboard (`GET /api/family/dashboard/:patientUserId`)
- **Actor**: Accepted family member
- **Data Returned**:
  - Patient info (name, email, phone, condition, expected discharge)
  - Current status + color indicator (stable, improving, declining, critical, in-hospital, discharged)
  - Status history (last 10 updates with timestamps)
- **Authorization**: Auth required + must have accepted family link
- **Refresh**: Frontend auto-refreshes every 30 seconds

### 4. Status Updates (`POST /api/family/status-update`)
- **Actors**: Patient OR linked caregiver
- **Data Posted**:
  - `patientUserId`: Which patient this update is for
  - `currentStatus`: Enum (stable, improving, declining, critical, in-hospital, discharged)
  - `hospitalName`: (optional) Current hospital/facility
  - `statusNote`: (optional) Text update ("Discharge moved to Dec 15", "Pain decreasing", etc.)
- **Authorization**: 
  - Patient can update own status
  - Linked family members can post updates with verification
- **Recording**: Captured in `patientStatusUpdates` table with updatedByUserId

### 5. Link Management (`GET /api/family/my-links`, `DELETE /api/family/link/:linkId`)
- **List all links**: Both as patient (inviter) and as family (invitee)
- **Remove link**: Either party can revoke access at any time
- **States**: pending → accepted (or rejected)

## Technical Architecture

### Database Schema

#### `familyLinks` Table
```typescript
{
  id: uuid (PK)
  patientUserId: uuid (FK → users.id) [REQUIRED]
  familyUserId: uuid (FK → users.id) [REQUIRED]
  relationship: text // "family", "spouse", "parent", "child", "caregiver", etc.
  status: familyLinkStatusEnum // "pending" | "accepted" | "rejected"
  createdAt: timestamp (defaultNow) // When invite was sent
  acceptedAt: timestamp // When family member accepted (NULL if pending/rejected)
}
```

**Unique Constraint**: `(patientUserId, familyUserId)` — prevents duplicate invites

#### `patientStatusUpdates` Table
```typescript
{
  id: uuid (PK)
  patientUserId: uuid (FK → users.id) [REQUIRED]
  hospitalName: text // "Mayo Clinic", "City General Hospital", etc.
  currentStatus: patientStatusEnum // "stable" | "improving" | "declining" | "critical" | "in-hospital" | "discharged"
  statusNote: text // "Pain improving", "Scheduled for discharge Dec 15", etc.
  updatedByUserId: uuid (FK → users.id) // Who posted (patient or caregiver)
  updatedAt: timestamp (defaultNow)
  createdAt: timestamp (defaultNow)
}
```

**Indexes**: 
- `patientUserId` + `updatedAt DESC` for timeline queries

#### New Enums
```typescript
familyLinkStatusEnum = ["pending", "accepted", "rejected"]
patientStatusEnum = ["stable", "improving", "declining", "critical", "in-hospital", "discharged"]
```

### Backend Routes (`/artifacts/api-server/src/routes/family.ts`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/family/link` | ✅ Required | Patient invites family by email |
| POST | `/api/family/link/:linkId/accept` | ✅ Required | Family accepts invitation |
| POST | `/api/family/link/:linkId/reject` | ✅ Required | Family rejects invitation |
| GET | `/api/family/dashboard/:patientUserId` | ✅ Required | Family views patient status + history |
| POST | `/api/family/status-update` | ✅ Required | Patient/caregiver posts status update |
| GET | `/api/family/my-links` | ✅ Required | List all links (both directions) |
| DELETE | `/api/family/link/:linkId` | ✅ Required | Remove a family link |

### Frontend Screens

#### 1. Link Patient Screen (`/artifacts/discharge-buddy/app/link-patient.tsx`)
**Path**: `/link-patient`  
**Audience**: Patients  
**Features**:
- Email input field for family member
- Relationship selector (family, caregiver, spouse, parent, child)
- Send Invitation button
- List of active & pending links
- Remove link button for each
- Help section explaining the process

**State Management**:
- `familyEmail`: Input text
- `relationship`: Selected category
- `loading`: Submit state
- `myLinks`: Active and pending links for current user

**API Calls**:
- `linkPatientByEmail(email, relationship)` — POST /api/family/link
- `getMyFamilyLinks()` — GET /api/family/my-links
- `removeFamilyLink(linkId)` — DELETE /api/family/link/:linkId

**UX Details**:
- Email validation (basic format check)
- Success/error alerts
- Auto-reload links after invite
- Gradient header (TEAL theme)
- Relationship chips for quick selection

#### 2. Family Dashboard Screen (`/artifacts/discharge-buddy/app/family-dashboard.tsx`)
**Path**: `/family-dashboard/:patientUserId` (or `/family-dashboard?patientUserId=...`)  
**Audience**: Linked family members  
**Features**:
- Patient card: name, phone, condition, expected discharge date
- Current status indicator: large status dot + color label (stable=green, critical=red, etc.)
- Status timeline: 10 most recent updates with timestamps
- Hospital name display (if provided)
- Auto-refresh every 30 seconds
- Pull-to-refresh support
- Empty state if no updates yet

**State Management**:
- `dashboard`: Loaded patient + status data
- `loading`: Initial load state
- `refreshing`: Pull-to-refresh state
- `error`: Error message display

**API Calls**:
- `getFamilyDashboard(patientUserId)` — GET /api/family/dashboard/:patientUserId

**UX Details**:
- Timeline visualization with colored dots
- Status color coding (stable=green, improving=blue, declining=amber, critical=red, discharged=cyan)
- Last update timestamp
- Mobile-responsive timeline
- Loading states
- Error recovery with retry button
- Auto-refresh indicator badge

### Frontend API Client (`ApiProvider.ts`)

New methods added:
```typescript
async linkPatientByEmail(familyEmail: string, relationship: string)
async acceptFamilyLink(linkId: string)
async rejectFamilyLink(linkId: string)
async getFamilyDashboard(patientUserId: string)
async postStatusUpdate(patientUserId: string, currentStatus: string, hospitalName?: string, statusNote?: string)
async getMyFamilyLinks()
async removeFamilyLink(linkId: string)
```

All use `customFetch` wrapper with JSON serialization.

## Data Flow Diagrams

### Invitation Flow
```
Patient (App)
    ↓ Enter family email + relationship
    ↓ Click "Send Invitation"
    ↓ POST /api/family/link
    ↓
API Server
    ↓ Verify email exists
    ↓ Check no duplicate link
    ↓ Create familyLinks record (status=pending)
    ↓ Send email notification
    ↓ Return link ID
    ↓
Family Member (Email)
    ↓ Receive invitation email
    ↓ Click "Accept" or "Reject"
    ↓ POST /api/family/link/:linkId/accept
    ↓
API Server
    ↓ Verify family member owns this invitation
    ↓ Update status to "accepted"
    ↓ Set acceptedAt timestamp
    ↓ Return success
    ↓
Family Member (App)
    ↓ Can now see patient dashboard
```

### Status Update Flow
```
Patient (App) or Linked Caregiver
    ↓ Navigate to status update screen (implies logged into patient account or caregiver account)
    ↓ Select status (stable/improving/declining/critical/in-hospital/discharged)
    ↓ Optional: Enter hospital name and status note
    ↓ POST /api/family/status-update
    ↓
API Server
    ↓ Verify user is patient or linked family member
    ↓ Create patientStatusUpdates record
    ↓ Record updatedByUserId
    ↓ Return success
    ↓
Family Members (Linked)
    ↓ See update on dashboard (auto-refresh in 0-30s)
    ↓ Timeline shows new entry at top
```

## Security & Authorization

### Link Access Control
- Only the invited family member (`familyUserId`) can accept/reject their own link
- Only patient (`patientUserId`) or family member (`familyUserId`) can delete a link
- Family can only see patient dashboard if link status is `accepted`

### Status Update Authorization
- Patient can post updates for their own ID
- Linked family member can post updates for the patient they're linked to
- Server verifies `req.user.id` matches patient OR has accepted link

### Data Isolation
- Queries filter by `patientUserId` to prevent cross-patient data leakage
- Link status checked before granting dashboard access

## Error Handling

### Backend Error Responses
| Scenario | Code | Message |
|----------|------|---------|
| Missing required fields | 400 | "Missing required fields: familyEmail, ..." |
| Email not found | 404 | "No user found with email ..." |
| Duplicate link | 400 | "Family link already pending/accepted" |
| Link not found | 404 | "Link not found" |
| Access denied | 403 | "Forbidden" or "You are not linked to this patient" |
| Internal error | 500 | "Failed to [action]" |

### Frontend Error Handling
- Try-catch blocks around all API calls
- Alert.alert() for user-facing errors
- Fallback UI states (loading, empty, error)
- Retry buttons on error screens
- Logging via console.error()

## Testing Scenarios

### Happy Path
1. Patient A invites family@example.com
2. Family member signs up / logs in
3. Family member accepts invitation
4. Family member sees Patient A's dashboard
5. Patient A posts "Stable" status update
6. Family member sees update refresh in <30s
7. Either party can remove the link

### Error Cases
1. Patient invites non-existent email → 404 error
2. Patient invites self → 400 error
3. Patient tries to invite same person twice → 400 error
4. Family member tries to view dashboard of non-linked patient → 403 error
5. Unauthenticated user tries to POST status update → 401 error

### Edge Cases
1. Link created but email sender fails → Link created anyway (logged warn)
2. Multiple tabs open: refresh dashboard in one tab, post update in another → Both see new update
3. Patient accepts own link attempt → 400 error (prevented by duplicate check)

## Integration Notes

### Email Service
- Uses existing `sendVerificationEmail()` function in email utilities
- Subject: `"${user.name} invited you"` (customized)
- Body: Standard invitation template

### Database Migrations
1. Add enums: `family_link_status`, `patient_status`
2. Create `family_links` table
3. Create `patient_status_updates` table
4. Add Zod schemas for validation

### Profile Navigation Integration
- Patients see "Link Family Member" button in profile actions
- Family members see "View Patient Status" button in profile actions
- Both routes protected by role check

## Future Enhancements

1. **Bulk invitations**: Invite multiple family members at once
2. **Notifications**: Push notifications when status updates occur
3. **Status templates**: Pre-made messages like "Feeling better today"
4. **Attachments**: Photos of test results, discharge papers
5. **Doctor access**: Allow doctors to view and update status
6. **Privacy levels**: Granular control over which info family sees
7. **Status history export**: PDF/CSV export of status timeline
8. **Alerts**: Automatic alerts if patient status changes to "critical"

## Deployment Checklist

- [ ] Database migrations applied (new tables + enums)
- [ ] Backend routes implemented and tested
- [ ] Frontend screens created and integrated
- [ ] API client methods added
- [ ] Profile navigation updated
- [ ] Email service configured
- [ ] Error handling verified
- [ ] Security authorization tested
- [ ] Cross-browser/device testing
- [ ] Documentation reviewed
- [ ] Staging deployment validated
- [ ] Production rollout

## Code Files Modified/Created

### Database Layer
- `lib/db/src/schema/index.ts` — Added enums, familyLinks, patientStatusUpdates tables, Zod schemas

### Backend
- `artifacts/api-server/src/routes/family.ts` — Enhanced with 7 new endpoints (merged with existing family routes)

### Frontend
- `artifacts/discharge-buddy/app/link-patient.tsx` — NEW: Patient UI for linking family members
- `artifacts/discharge-buddy/app/family-dashboard.tsx` — NEW: Family member UI for viewing patient status
- `artifacts/discharge-buddy/context/ApiProvider.ts` — Added 7 new API methods
- `artifacts/discharge-buddy/app/profile.tsx` — Added "Link Family Member" and "View Patient Status" buttons

---

**Feature Status**: ✅ Implementation Complete

**Date Added**: 2024 Q4

**Owner**: Platform Team
