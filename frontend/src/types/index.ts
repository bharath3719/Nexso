/**
 * Nexso â€” shared TypeScript interfaces and types
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Keep only structural shapes that are passed across component boundaries.
 * Pure domain / styling constants stay in constants.js and cssConstants.js.
 */

// â”€â”€â”€ Vendor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Vendor {
  id: number;
  name: string;
  business_name?: string | null;
  owner_name?: string | null;
  phone?: string | null;
  email?: string | null;
  gst?: string | null;
  whatsapp_number?: string | null;
  categories: string[];
  team_size?: number | null;
  emergency_availability: boolean;
  active: boolean;
  verification_status: "VERIFICATION_PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  verified_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

interface VendorDocument {
  id: number;
  vendor_id: number;
  doc_type?: string | null;
  filename?: string | null;
  url: string;
  metadata?: Record<string, unknown> | null;
  uploaded_at: string;
}

// â”€â”€â”€ Ticket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TicketStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

interface Ticket {
  id: number;
  ticket_id?: string | null;
  society_id?: number | null;
  society_name?: string | null;
  raised_by_user_id?: number | null;
  raised_by_name?: string | null;
  raised_by_number?: string | null;
  raised_by_apartment?: string | null;
  category: string;
  description?: string | null;
  priority: string;
  status: TicketStatus;
  assigned_vendor_id?: number | null;
  vendor_id?: number | null;
  vendor_name?: string | null;
  created_at: string;
  updated_at: string;
}

// â”€â”€â”€ Society / Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type SocietyType = "APARTMENT" | "GATED_COMMUNITY" | "COMMERCIAL" | "MIXED_USE";

interface Society {
  id: number;
  name: string;
  building_id?: string | null;
  address?: string | null;
  society_type: SocietyType;
  num_towers?: number | null;
  num_floors?: number | null;
  num_units?: number | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  onboarding_step: number;
  unit_count?: number;
  resident_count?: number;
  created_at: string;
}

interface Unit {
  id: number;
  unit_number: string;
  floor_id: number;
  society_id: number;
}

interface Floor {
  id: number;
  floor_number: number;
  tower_id: number;
  units: Unit[];
}

interface Tower {
  id: number;
  name: string;
  society_id: number;
  floors: Floor[];
}

interface Resident {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  aadhar_number?: string | null;
  preferred_contact: "WHATSAPP" | "CALL" | "SMS" | "EMAIL";
  bhk?: string | null;
  resident_type: "OWNER" | "TENANT";
  family_members: number;
  unit_id: number;
  society_id: number;
  invitation_status: "PENDING" | "JOINED" | "ACTIVE";
}

// â”€â”€â”€ User â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type UserRole = "OWNER" | "SOCIETY_ADMIN" | "VENDOR";

interface AppUser {
  id: number;
  name?: string | null;
  full_name?: string | null;
  user_name?: string | null;
  whatsapp_number: string;
  role: UserRole;
  society_id?: number | null;
  apartment?: string | null;
  created_at: string;
}

// â”€â”€â”€ Component prop shapes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface StatusBadgeProps {
  status: string;
}
