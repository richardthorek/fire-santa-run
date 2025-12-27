/**
 * Audit logging utility for tracking security-relevant events.
 * 
 * Logs authentication events, membership changes, and admin actions
 * for security auditing and compliance.
 */

/**
 * Audit event types
 */
export type AuditEventType =
  // Authentication events
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.token_refresh'
  | 'auth.session_expired'
  
  // User management events
  | 'user.created'
  | 'user.updated'
  | 'user.profile_viewed'
  
  // Brigade events
  | 'brigade.created'
  | 'brigade.claimed'
  | 'brigade.updated'
  | 'brigade.settings_changed'
  
  // Membership events
  | 'membership.invited'
  | 'membership.invitation_accepted'
  | 'membership.invitation_declined'
  | 'membership.invitation_cancelled'
  | 'membership.approved'
  | 'membership.rejected'
  | 'membership.removed'
  | 'membership.left'
  
  // Role changes
  | 'role.promoted_to_admin'
  | 'role.demoted_from_admin'
  | 'role.changed'
  
  // Route events
  | 'route.created'
  | 'route.updated'
  | 'route.deleted'
  | 'route.published'
  | 'route.started'
  | 'route.completed'
  
  // Security events
  | 'security.unauthorized_access'
  | 'security.permission_denied'
  | 'security.suspicious_activity';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Unique log entry ID */
  id: string;
  
  /** Event type */
  eventType: AuditEventType;
  
  /** User who performed the action */
  userId?: string;
  
  /** User email */
  userEmail?: string;
  
  /** Brigade context */
  brigadeId?: string;
  
  /** Target user (for membership/role changes) */
  targetUserId?: string;
  
  /** Resource ID (route, invitation, etc.) */
  resourceId?: string;
  
  /** Additional event metadata */
  metadata?: Record<string, unknown>;
  
  /** Event message */
  message: string;
  
  /** Timestamp */
  timestamp: string;
  
  /** IP address (if available) */
  ipAddress?: string;
  
  /** User agent */
  userAgent?: string;
}

/**
 * Log an audit event.
 * 
 * In production, this should send logs to Azure Table Storage or Application Insights.
 * In development, logs to console.
 */
export function logAuditEvent(
  eventType: AuditEventType,
  message: string,
  context: {
    userId?: string;
    userEmail?: string;
    brigadeId?: string;
    targetUserId?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): void {
  const entry: AuditLogEntry = {
    id: self.crypto.randomUUID(),
    eventType,
    message,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    ...context,
  };

  // In development, log to console
  if (import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true') {
    console.log('[Audit]', {
      type: eventType,
      message,
      ...context,
    });
  }

  // In production, send to Azure Table Storage or Application Insights
  // This would be implemented as an API call to /api/audit/log
  if (import.meta.env.PROD && import.meta.env.VITE_DEV_MODE !== 'true') {
    // Queue the log entry for batch sending
    queueAuditLog(entry);
  }
}

/**
 * Queued audit logs (for batch sending)
 */
let auditLogQueue: AuditLogEntry[] = [];

/**
 * Queue an audit log for batch sending.
 */
function queueAuditLog(entry: AuditLogEntry): void {
  auditLogQueue.push(entry);
  
  // Send batch every 10 logs or after 30 seconds
  if (auditLogQueue.length >= 10) {
    flushAuditLogs();
  } else {
    // Schedule flush after 30 seconds
    setTimeout(flushAuditLogs, 30000);
  }
}

/**
 * Flush queued audit logs to the server.
 */
async function flushAuditLogs(): Promise<void> {
  if (auditLogQueue.length === 0) return;
  
  const logs = [...auditLogQueue];
  auditLogQueue = [];
  
  try {
    // Send to API endpoint
    await fetch('/api/audit/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs }),
    });
  } catch (error) {
    console.error('[Audit] Failed to send logs:', error);
    // Re-queue failed logs (up to a limit)
    if (auditLogQueue.length < 100) {
      auditLogQueue.unshift(...logs);
    }
  }
}

/**
 * Helper functions for common audit events
 */

export function logLogin(userId: string, email: string): void {
  logAuditEvent('auth.login', `User logged in: ${email}`, { userId, userEmail: email });
}

export function logLogout(userId: string, email: string): void {
  logAuditEvent('auth.logout', `User logged out: ${email}`, { userId, userEmail: email });
}

export function logLoginFailed(email: string, reason: string): void {
  logAuditEvent('auth.login_failed', `Login failed for ${email}: ${reason}`, { userEmail: email });
}

export function logBrigadeClaimed(
  userId: string,
  userEmail: string,
  brigadeId: string,
  brigadeName: string
): void {
  logAuditEvent(
    'brigade.claimed',
    `Brigade "${brigadeName}" claimed by ${userEmail}`,
    { userId, userEmail, brigadeId }
  );
}

export function logMemberInvited(
  inviterUserId: string,
  inviterEmail: string,
  invitedEmail: string,
  brigadeId: string,
  role: string
): void {
  logAuditEvent(
    'membership.invited',
    `${inviterEmail} invited ${invitedEmail} as ${role}`,
    {
      userId: inviterUserId,
      userEmail: inviterEmail,
      brigadeId,
      metadata: { invitedEmail, role },
    }
  );
}

export function logMemberApproved(
  approverUserId: string,
  approverEmail: string,
  targetUserId: string,
  targetEmail: string,
  brigadeId: string
): void {
  logAuditEvent(
    'membership.approved',
    `${approverEmail} approved membership for ${targetEmail}`,
    {
      userId: approverUserId,
      userEmail: approverEmail,
      brigadeId,
      targetUserId,
      metadata: { targetEmail },
    }
  );
}

export function logMemberRemoved(
  removerUserId: string,
  removerEmail: string,
  targetUserId: string,
  targetEmail: string,
  brigadeId: string,
  reason?: string
): void {
  logAuditEvent(
    'membership.removed',
    `${removerEmail} removed ${targetEmail}${reason ? `: ${reason}` : ''}`,
    {
      userId: removerUserId,
      userEmail: removerEmail,
      brigadeId,
      targetUserId,
      metadata: { targetEmail, reason },
    }
  );
}

export function logRoleChanged(
  changerUserId: string,
  changerEmail: string,
  targetUserId: string,
  targetEmail: string,
  brigadeId: string,
  oldRole: string,
  newRole: string
): void {
  const eventType = newRole === 'admin' ? 'role.promoted_to_admin' : 
                    oldRole === 'admin' ? 'role.demoted_from_admin' : 
                    'role.changed';
  
  logAuditEvent(
    eventType,
    `${changerEmail} changed ${targetEmail}'s role from ${oldRole} to ${newRole}`,
    {
      userId: changerUserId,
      userEmail: changerEmail,
      brigadeId,
      targetUserId,
      metadata: { targetEmail, oldRole, newRole },
    }
  );
}

export function logUnauthorizedAccess(
  userId: string | undefined,
  resource: string,
  action: string
): void {
  logAuditEvent(
    'security.unauthorized_access',
    `Unauthorized access attempt: ${action} on ${resource}`,
    {
      userId,
      metadata: { resource, action },
    }
  );
}

export function logPermissionDenied(
  userId: string,
  resource: string,
  action: string,
  requiredRole: string
): void {
  logAuditEvent(
    'security.permission_denied',
    `Permission denied: ${action} on ${resource} (requires ${requiredRole})`,
    {
      userId,
      metadata: { resource, action, requiredRole },
    }
  );
}
