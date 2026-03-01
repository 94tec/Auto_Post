// server/models/passwordResetModel.js
import { adminDb } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

class PasswordResetModel {
  constructor() {
    // Use adminDb (Admin SDK RTDB) for all operations
    this.verificationsRef = adminDb.ref('password-reset-verifications');
    this.verificationsByUserIndexRef = adminDb.ref('indexes/password-reset-verifications_by_user');
  }

  async create(data) {
    try {
      // 1. Validate required fields
      const { userId, token, email, type = 'password_reset_verification' } = data;
      if (!userId) throw new Error('userId is required');
      if (!token) throw new Error('token is required');
      if (!email) throw new Error('email is required');

      // 2. Check for existing active verification records for this email and type
      const snapshot = await this.verificationsRef
        .orderByChild('email')
        .equalTo(email)
        .once('value');

      if (snapshot.exists()) {
        const now = new Date();
        const existingActive = Object.entries(snapshot.val()).find(
          ([_, record]) =>
            record.email === email &&
            record.type === type &&
            !record.consumed &&
            new Date(record.expiresAt) > now
        );

        if (existingActive) {
          const [existingId, record] = existingActive;
          console.info(`⚠️ Active verification exists for ${email}, reusing it.`);
          return {
            ...record,
            _path: `/password-reset-verifications/${existingId}`,
            reused: true,
          };
        }
      }

      // 3. Prepare the new record
      const id = uuidv4();
      const now = new Date().toISOString();
      const record = {
        ...data,
        id,
        type,
        createdAt: now,
        updatedAt: now,
        consumed: false,
        expiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      // 4. Multi-path update to create record and update index
      const updates = {};
      updates[`/password-reset-verifications/${id}`] = record;
      updates[`/indexes/password-reset-verifications_by_user/${userId}/${id}`] = true;

      await adminDb.ref().update(updates); // root reference update with absolute paths

      // 5. Return the created record
      return {
        ...record,
        _path: `/password-reset-verifications/${id}`,
      };
    } catch (error) {
      console.error('Failed to create verification record:', error);
      let errorMessage = error.message;
      if (error.code && error.code.startsWith('PERMISSION_DENIED')) {
        errorMessage = 'Insufficient permissions to create verification record.';
      } else if (error.code) {
        errorMessage = `Database operation failed: ${error.code}`;
      }
      throw new Error(`Verification record creation failed: ${errorMessage}`);
    }
  }

  async findByToken(token) {
    try {
      const snapshot = await this.verificationsRef.once('value');
      if (!snapshot.exists()) return null;

      const allVerifications = snapshot.val();
      const now = Date.now();

      for (const verificationId in allVerifications) {
        const record = allVerifications[verificationId];
        if (record.token === token) {
          const isExpired = record.expiresAt && now > new Date(record.expiresAt).getTime();
          const isConsumed = record.consumed === true;

          if (isExpired) {
            console.warn(`⏰ Verification token ${verificationId} found but expired.`);
          }
          if (isConsumed) {
            console.warn(`✅ Verification token ${verificationId} found but already consumed.`);
          }

          if (!isExpired && !isConsumed) {
            return { id: verificationId, ...record };
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding verification token:', error);
      throw new Error(`Failed to find verification token: ${error.message}`);
    }
  }

  async findOne(query) {
    try {
      const { userId, email, consumed = false } = query;
      const expiresAtCondition = query.expiresAt || { $gt: new Date() };
      const snapshot = await this.verificationsRef.once('value');
      if (!snapshot.exists()) return null;

      const verifications = snapshot.val();
      const now = new Date();

      for (const id in verifications) {
        const verification = verifications[id];
        const verificationExpiresAt = new Date(verification.expiresAt);

        const matchesUserId = userId ? verification.userId === userId : true;
        const matchesEmail = email ? verification.email === email : true;
        const matchesConsumed = verification.consumed === consumed;
        const matchesExpiresAt = expiresAtCondition.$gt
          ? verificationExpiresAt > now
          : true;

        if (matchesUserId && matchesEmail && matchesConsumed && matchesExpiresAt) {
          return { id, ...verification };
        }
      }
      return null;
    } catch (error) {
      console.error('Error in findOne:', error);
      throw new Error(`Failed to find verification: ${error.message}`);
    }
  }

  async findActiveVerifications(userId, type) {
    try {
      const indexSnapshot = await this.verificationsByUserIndexRef.child(userId).once('value');
      if (!indexSnapshot.exists()) return [];

      const verificationIds = Object.keys(indexSnapshot.val());
      const activeVerifications = [];
      const now = Date.now();

      for (const id of verificationIds) {
        const snap = await this.verificationsRef.child(id).once('value');
        const verification = snap.val();
        if (
          verification &&
          verification.type === type &&
          verification.consumed === false &&
          new Date(verification.expiresAt).getTime() > now
        ) {
          activeVerifications.push(verification);
        }
      }
      return activeVerifications;
    } catch (error) {
      console.error('Error finding active verifications:', error);
      throw new Error(`Failed to retrieve active verifications: ${error.message}`);
    }
  }

  async markAsConsumed(id) {
    try {
      if (!id) throw new Error('Verification ID is required to mark as consumed.');
      const now = new Date().toISOString();
      const updates = {
        consumed: true,
        consumedAt: now,
        updatedAt: now,
      };
      const ref = this.verificationsRef.child(id);
      const snapshot = await ref.once('value');
      if (!snapshot.exists()) {
        throw new Error(`Verification record with ID ${id} does not exist.`);
      }
      await ref.update(updates);
      console.log(`✅ Verification ${id} marked as consumed.`);
    } catch (error) {
      console.error(`❌ Error marking verification ${id} as consumed:`, error);
      throw new Error(`Failed to mark verification as consumed: ${error.message}`);
    }
  }

  async deleteAllForUser(userId) {
    try {
      const indexSnapshot = await this.verificationsByUserIndexRef.child(userId).once('value');
      if (!indexSnapshot.exists()) {
        console.warn(`No verification records found for user ${userId} to delete.`);
        return;
      }

      const verificationIds = Object.keys(indexSnapshot.val());
      const updates = {};
      verificationIds.forEach(id => {
        updates[`/password-reset-verifications/${id}`] = null;
      });
      updates[`/indexes/password-reset-verifications_by_user/${userId}`] = null;

      await adminDb.ref().update(updates);
      console.log(`Successfully deleted all verification records for user ${userId}.`);
    } catch (error) {
      console.error(`Error deleting all verification records for user ${userId}:`, error);
      throw new Error(`Failed to delete all verifications for user: ${error.message}`);
    }
  }
}

export default new PasswordResetModel();