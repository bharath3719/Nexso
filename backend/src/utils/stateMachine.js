export const TicketStatus = {
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

export const Roles = {
  OWNER: "OWNER",
  SOCIETY_ADMIN: "SOCIETY_ADMIN",
  VENDOR: "VENDOR",
  UNKNOWN: "UNKNOWN",
};

const transitions = {
  [TicketStatus.OPEN]: [TicketStatus.ASSIGNED],
  [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.RESOLVED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [],
};

const rolePermissions = {
  [Roles.OWNER]: {
    [TicketStatus.OPEN]: [TicketStatus.CLOSED], // owner can close own tickets if resolved
    [TicketStatus.ASSIGNED]: [],
    [TicketStatus.IN_PROGRESS]: [],
    [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
    [TicketStatus.CLOSED]: [],
  },
  [Roles.SOCIETY_ADMIN]: {
    [TicketStatus.OPEN]: [TicketStatus.ASSIGNED],
    [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
    [TicketStatus.IN_PROGRESS]: [TicketStatus.RESOLVED],
    [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
    [TicketStatus.CLOSED]: [],
  },
  [Roles.VENDOR]: {
    [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
    [TicketStatus.IN_PROGRESS]: [TicketStatus.RESOLVED],
    [TicketStatus.RESOLVED]: [],
    [TicketStatus.OPEN]: [],
    [TicketStatus.CLOSED]: [],
  },
};

export function canTransition(from, to, role) {
  const allowedNext = transitions[from] || [];
  if (!allowedNext.includes(to)) return false;
  const roleMap = rolePermissions[role] || {};
  const roleAllowed = (roleMap[from] || []).includes(to);
  return roleAllowed;
}
