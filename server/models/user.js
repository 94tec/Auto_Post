import { db } from '../config/firebase.js';
import { hashPassword, encodeFirebaseKey } from '../utils/validator.js';
import { parseUserAgent } from '../utils/security.js';

class UserModel {
  constructor() {
    this.usersRef = db.ref('users');
    this.indexRef = db.ref('indexes/users_by_email');
  }

  async createUser(userData) {
    try {
      const { email, password, name, ip, userAgent } = userData;
    
      // Await if email is a Promise
      if (email instanceof Promise) {
        email = await email;
      }

      // Defensive check
      if (!email || typeof email !== 'string') {
        throw new Error('Invalid email provided.');
      }

      // Sanitize email for Firebase index path (optional, safer if you use as key)
      //const safeEmailKey = email.replace(/\./g, ',');
      const safeEmailKey = encodeFirebaseKey(email)

      const uid = userData.uid || this.usersRef.push().key;
      
      // Validate required fields
      if (!email || !password || !name) {
        throw new Error('Missing required fields: email, password, name');
      }     
      const parsedDevice = parseUserAgent(userAgent);
 
      // 1. Prepare user document
      const user = {
        basic: {
          uid,
          email,
          name,
          status: 'pending_verification',
          createdAt: { '.sv': 'timestamp' }, 
          updatedAt: { '.sv': 'timestamp' }
        },
        security: {
          passwordHash: await hashPassword(password),
          mfaEnabled: false,
          failedLoginAttempts: 0,
          registrationIp: ip,
          lastPasswordChange: { '.sv': 'timestamp' }
        },
        metadata: {
          userAgent: parsedDevice,
          knownDevices: {},
          preferences: {}
        }
      };
      console.log('Attempting to create user:', { uid, email });

       // 2. Write to database using multi-path update
      const updates = {};
      updates[`users/${uid}`] = user;
      updates[`indexes/users_by_email/${safeEmailKey}`] = uid;

      await db.ref().update(updates)
        .then(() => console.log('Write operation completed'))
        .catch(err => {
          console.error('Write operation failed:', err);
          throw err;
        });

      // 3. Verify write with retry logic
      let snapshot;
      let attempts = 0;
      const maxAttempts = 3;
      const retryDelay = 500; // ms
      
      while (attempts < maxAttempts) {
        snapshot = await this.usersRef.child(uid).once('value');
        if (snapshot.exists()) break;
        attempts++;
        console.log(`Verification attempt ${attempts} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (!snapshot.exists()) {
        console.error('Data verification failed after retries');
        throw new Error('User creation failed - data not persisted');
      }

      console.log('User successfully created:', uid);
      return { uid, ...user.basic };

    } catch (error) {
      console.error('User creation error:', {
        error: error.message,
        stack: error.stack,
        userData: { email: userData?.email }
      });
      throw error;
    }
  }
  
  async getUserByEmail(email) {
    try {
      const encodedEmail = encodeFirebaseKey(email);
      const indexSnapshot = await this.indexRef.child(encodedEmail).once('value');
      const uid = indexSnapshot.val();
      
      if (!uid) return null;
      
      const userSnapshot = await this.usersRef.child(uid).once('value');
      return userSnapshot.exists() ? userSnapshot.val() : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  async getUserById(uid) {
    try {
      const snapshot = await this.usersRef.child(uid).once('value');
      if (!snapshot.exists()) return null;

      const user = snapshot.val();
      return {
        uid,
        ...user.basic,
        security: user.security,
        metadata: user.metadata
      };
    } catch (error) {
      console.error(`Error getting user by ID (${uid}):`, error);
      throw new Error(`Failed to get user by ID: ${error.message}`);
    }
  }


  async updateUser(uid, updates) {
    try {
      updates['basic.updatedAt'] = Date.now();
      await this.usersRef.child(uid).update(updates);

      // Return updated basic info
      const updated = await this.usersRef.child(`${uid}/basic`).once('value');
      return updated.exists() ? updated.val() : null;
    } catch (error) {
      console.error(`Error updating user (${uid}):`, error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(uid) {
    try {
      const snapshot = await this.usersRef.child(uid).once('value');
      if (!snapshot.exists()) throw new Error('User not found');

      const email = snapshot.val()?.basic?.email;
      if (!email) throw new Error('Email index missing');

      await db.ref().update({
        [`users/${uid}`]: null,
        [`indexes/users_by_email/${email}`]: null
      });

      return true;
    } catch (error) {
      console.error(`Error deleting user (${uid}):`, error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
  async getFullUser(uid) {
    try {
      const snapshot = await this.usersRef.child(uid).once('value');
      if (!snapshot.exists()) return null;

      const user = snapshot.val();
      return {
        uid,
        ...user.basic,
        security: user.security,
        metadata: user.metadata,
        verifications: user.verifications || {}
      };
    } catch (error) {
      console.error(`Error fetching full user (${uid}):`, error);
      throw new Error(`Failed to get full user: ${error.message}`);
    }
  }

  async getAllUsers() {
    try {
      const snapshot = await this.usersRef.once('value');
      if (!snapshot.exists()) return [];

      const users = snapshot.val();
      return Object.entries(users).map(([uid, user]) => ({
        uid,
        ...user.basic
      }));
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw new Error(`Failed to get all users: ${error.message}`);
    }
  }

}
export default new UserModel();

