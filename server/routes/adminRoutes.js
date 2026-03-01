/**
 * routes/adminRoutes.js
 * ═══════════════════════════════════════════════════════════════════
 * ALL routes on this router require [verifyToken + requireAdmin].
 * requireAdmin returns 404 to non-admins — obscures route existence.
 *
 * FULL ROUTE MAP
 * ───────────────────────────────────────────────────────────────────
 *  GET    /stats                       system dashboard
 *  GET    /audit-logs                  recent audit events
 *  GET    /approval-queue              guests awaiting step-2 approval
 *  GET    /pending-write               users eligible for write access
 *  GET    /users                       all users (?role&status)
 *  GET    /users/:uid                  single user detail
 *  POST   /users/:uid/approve          step-2: approve guest → user
 *  POST   /users/:uid/grant-write      grant write permission
 *  POST   /users/:uid/revoke-write     revoke write permission
 *  PATCH  /users/:uid/permissions      override specific permissions
 *  POST   /users/:uid/suspend          suspend account
 *  POST   /users/:uid/reactivate       reactivate account
 * ═══════════════════════════════════════════════════════════════════
 */
import { Router }       from 'express';
import {
  getQueue, approveUser,
  listUsers, getUserDetail,
  grantWrite, revokeWrite, patchPermissions,
  suspendUser, reactivateUser,
  getPendingWriteAccess,
  getAuditLogs, getStats,
}                       from '../controllers/adminController.js';
import { verifyToken, requireAdmin } from '../middlewares/auth.js';
import { adminRateLimiter }          from '../middlewares/rateLimiter.js';

const router = Router();

// ── Apply guards to entire router ────────────────────────────────
router.use(verifyToken, requireAdmin, adminRateLimiter);

// ── Dashboard ─────────────────────────────────────────────────────
router.get('/stats',          getStats);
router.get('/audit-logs',     getAuditLogs);
router.get('/approval-queue', getQueue);
router.get('/pending-write',  getPendingWriteAccess);

// ── User list ─────────────────────────────────────────────────────
router.get('/users',       listUsers);
router.get('/users/:uid',  getUserDetail);

// ── Approval (guest step 2) ───────────────────────────────────────
router.post('/users/:uid/approve', approveUser);

// ── Write access ──────────────────────────────────────────────────
router.post('/users/:uid/grant-write',  grantWrite);
router.post('/users/:uid/revoke-write', revokeWrite);

// ── Granular permissions ──────────────────────────────────────────
router.patch('/users/:uid/permissions', patchPermissions);

// ── Account status ────────────────────────────────────────────────
router.post('/users/:uid/suspend',    suspendUser);
router.post('/users/:uid/reactivate', reactivateUser);

export default router;