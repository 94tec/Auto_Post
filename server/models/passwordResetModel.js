// server/models/VerificationModel.js
import { db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

class PasswordResetModel {
  constructor() {
    this.verificationsRef = db.ref('password-reset-verifications');
    this.verificationsByUserIndexRef = db.ref('indexes/password-reset-verifications_by_user');
  }

  async create(data) {
    try {
      // 1. Validate required fields
      const { userId, token, email, type = 'password_reset_verification' } = data;
      if (!userId) throw new Error('userId is required');
      if (!token) throw new Error('token is required');
      if (!email) throw new Error('email is required');

      // 2. Check for existing active verification records for this email and type
      //const allVerificationsSnapshot = await this.verificationsRef.once('value');
      const snapshot = await db
        .ref(this.verificationsRef)
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
            reused: true // optional flag to signal reuse
          };
        }
      }

      // 3. Prepare the new record
      const id = uuidv4();
      const now = new Date().toISOString();
      const record = {
        ...data,
        id,
        type, // Ensure type is explicitly set
        createdAt: now,
        updatedAt: now,
        consumed: false,
        // Default expiresAt to 24 hours from now if not provided
        expiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      // 4. Create the record and update the index using a multi-path update or transaction
      // A multi-path update is generally more efficient than a transaction for independent paths.
      const updates = {};
      updates[`/password-reset-verifications/${id}`] = record;
      updates[`/indexes/password-reset-verifications_by_user/${userId}/${id}`] = true; // Index entry

      await db.ref().update(updates);

      // 5. Return the created record
      return {
        ...record,
        _path: `/password-reset-verifications/${id}`
      };

    } catch (error) {
      console.error('Failed to create verification record:', error);
      // Convert Firebase errors to more user-friendly messages
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
      // Fetch all verification records. This can be inefficient for a very large number of records.
      const allVerificationsSnapshot = await this.verificationsRef.once('value');

      if (!allVerificationsSnapshot.exists()) {
        return null;
      }

      const allVerifications = allVerificationsSnapshot.val();
      const now = Date.now();

      for (const verificationId in allVerifications) {
        const record = allVerifications[verificationId];

        const isMatchingToken = record.token === token;
        const isExpired = record.expiresAt && now > new Date(record.expiresAt).getTime();
        const isConsumed = record.consumed === true;

        if (isMatchingToken) {
          if (isExpired) {
            console.warn(`⏰ Verification token ${verificationId} found but expired.`);
          }
          if (isConsumed) {
            console.warn(`✅ Verification token ${verificationId} found but already consumed.`);
          }

          if (!isExpired && !isConsumed) {
            return {
              id: verificationId,
              ...record // record should contain userId
            };
          }
        }
      }

      return null; // No valid, unexpired, and unconsumed token found
    } catch (error) {
      console.error('Error finding verification token:', error);
      // More specific error message for client-side debugging
      throw new Error(`Failed to find verification token: ${error.message}`);
    }
 }
  async findOne(query) {
    try {
      const { userId, email, consumed = false } = query;
      const expiresAtCondition = query.expiresAt || { $gt: new Date() };
      
      // Get all verifications
      const snapshot = await this.verificationsRef.once('value');
      
      if (!snapshot.exists()) {
        return null;
      }

      const verifications = snapshot.val();
      const now = new Date();

      // Find matching verification
      for (const id in verifications) {
        const verification = verifications[id];
        const verificationExpiresAt = new Date(verification.expiresAt);
        
        // Check all conditions
        const matchesUserId = userId ? verification.userId === userId : true;
        const matchesEmail = email ? verification.email === email : true;
        const matchesConsumed = verification.consumed === consumed;
        const matchesExpiresAt = expiresAtCondition.$gt 
          ? verificationExpiresAt > now 
          : true;

        if (matchesUserId && matchesEmail && matchesConsumed && matchesExpiresAt) {
          return {
            id,
            ...verification
          };
        }
      }

      return null; // No matching verification found
    } catch (error) {
      console.error('Error in findOne:', error);
      throw new Error(`Failed to find verification: ${error.message}`);
    }
  }

  async findActiveVerifications(userId, type) {
    try {
      // Get all verification IDs for the user from the index
      const indexSnapshot = await this.verificationsByUserIndexRef.child(userId).once('value');
      if (!indexSnapshot.exists()) {
        return [];
      }

      const verificationIds = Object.keys(indexSnapshot.val());
      const activeVerifications = [];
      const now = Date.now();

      for (const id of verificationIds) {
        const snap = await this.verificationsRef.child(id).once('value');
        const verification = snap.val();

        if (verification &&
            verification.type === type &&
            verification.consumed === false &&
            new Date(verification.expiresAt).getTime() > now) { // Compare timestamps
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
      if (!id) {
        throw new Error('Verification ID is required to mark as consumed.');
      }
      const now = new Date().toISOString();
      const updates = {
        consumed: true,
        consumedAt: now,
        updatedAt: now
      };

      const ref = this.verificationsRef.child(id);

      // Check if verification exists before updating (optional but safe)
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
      // First, get all verification IDs for the user from the index
      const indexSnapshot = await this.verificationsByUserIndexRef.child(userId).once('value');
      if (!indexSnapshot.exists()) {
        console.warn(`No verification records found for user ${userId} to delete.`);
        return; // Nothing to delete
      }

      const verificationIds = Object.keys(indexSnapshot.val());
      const updates = {};

      // Prepare updates to delete each individual verification record and the index entry
      verificationIds.forEach(id => {
        updates[`/verifications/${id}`] = null; // Set to null to delete the node
      });
      updates[`/indexes/verifications_by_user/${userId}`] = null; // Delete the entire user's index entry

      await db.ref().update(updates);
      console.log(`Successfully deleted all verification records for user ${userId}.`);

    } catch (error) {
      console.error(`Error deleting all verification records for user ${userId}:`, error);
      throw new Error(`Failed to delete all verifications for user: ${error.message}`);
    }
  }
}

export default new PasswordResetModel();