/**
 * firestore-x-schema.js
 * ─────────────────────────────────────────────────────────────
 * Firestore collections used by the X integration.
 * This file is documentation + type definitions — not runtime code.
 *
 * Add the indexes to firestore.indexes.json and deploy:
 *   firebase deploy --only firestore:indexes
 * ─────────────────────────────────────────────────────────────
 */

/* ─────────────────────────────────────────────────────────────
   Collection: xTokens
   Document ID: {uid}  (one doc per Damuchi user)
   ─────────────────────────────────────────────────────────────
   {
     accessToken:   string  — AES-encrypted X access token
     refreshToken:  string  — AES-encrypted X refresh token
     expiresAt:     number  — Unix ms when access token expires
     xUserId:       string  — X user ID (numeric string)
     xUsername:     string  — X handle without @
     xProfileImage: string | null
     connectedAt:   number  — Unix ms
     updatedAt:     number  — Unix ms

     // Security rules: only the owning uid may read/write
   }

   Firestore security rule:
     match /xTokens/{uid} {
       allow read, write: if request.auth.uid == uid;
     }
*/

/* ─────────────────────────────────────────────────────────────
   Collection: xOAuthState
   Document ID: {uid}
   Ephemeral — deleted after callback, TTL-swept by Cloud Function
   ─────────────────────────────────────────────────────────────
   {
     state:        string  — random hex, matches URL state param
     codeVerifier: string  — PKCE verifier
     createdAt:    number  — Unix ms
     expiresAt:    number  — Unix ms  (10 minutes from creation)
   }

   Firestore security rule:
     match /xOAuthState/{uid} {
       allow read, write: if false;  // backend-only via Admin SDK
     }
*/

/* ─────────────────────────────────────────────────────────────
   Collection: xPostLog
   Document ID: auto-generated
   ─────────────────────────────────────────────────────────────
   {
     uid:        string   — Damuchi user who posted
     sourceId:   string   — ID of the quote / lyric / daily card
     sourceType: string   — 'quote' | 'lyric' | 'daily'
     text:       string   — exact tweet text sent
     tweetId:    string   — X tweet ID (success only)
     tweetUrl:   string   — full tweet URL (success only)
     status:     string   — 'success' | 'failed'
     error:      string   — error detail (failed only)
     postedAt:   number   — Unix ms

     // Security rules: user can read their own logs
   }

   Firestore security rule:
     match /xPostLog/{logId} {
       allow read: if request.auth.uid == resource.data.uid;
       allow write: if false;  // backend-only
     }
*/

/* ─────────────────────────────────────────────────────────────
   firestore.indexes.json  (add to your existing file)
   ─────────────────────────────────────────────────────────────
*/
export const firestoreIndexes = {
  indexes: [
    {
      collectionGroup: "xPostLog",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "uid",      order: "ASCENDING"  },
        { fieldPath: "postedAt", order: "DESCENDING" },
      ],
    },
    {
      collectionGroup: "xPostLog",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "uid",        order: "ASCENDING"  },
        { fieldPath: "sourceId",   order: "ASCENDING"  },
        { fieldPath: "postedAt",   order: "DESCENDING" },
      ],
    },
  ],
};

/* ─────────────────────────────────────────────────────────────
   Cloud Function: sweep expired xOAuthState docs (optional)
   Add to functions/index.js
   ─────────────────────────────────────────────────────────────
*/
export const sweepExpiredOAuthStateFn = `
// functions/index.js
import * as functions from 'firebase-functions';
import * as admin     from 'firebase-admin';

export const sweepXOAuthState = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => {
    const db   = admin.firestore();
    const snap = await db.collection('xOAuthState')
      .where('expiresAt', '<', Date.now())
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(\`Swept \${snap.size} expired xOAuthState docs\`);
  });
`;

/* ─────────────────────────────────────────────────────────────
   Express app registration (add to your main server file)
   ─────────────────────────────────────────────────────────────

   import xRoutes from './routes/x.routes.js';
   app.use('/api/x', xRoutes);

   ─────────────────────────────────────────────────────────────
   Required .env variables:
   ─────────────────────────────────────────────────────────────

   X_CLIENT_ID=your_x_oauth2_client_id
   X_CLIENT_SECRET=your_x_oauth2_client_secret
   X_REDIRECT_URI=https://yourdomain.com/api/x/callback
   X_TOKEN_ENCRYPT_SECRET=a_strong_random_32plus_char_string
   FRONTEND_URL=https://yourdomain.com

   ─────────────────────────────────────────────────────────────
   X Developer Portal setup:
   ─────────────────────────────────────────────────────────────
   1. Go to https://developer.twitter.com/en/portal/dashboard
   2. Create / select your app
   3. Under "User authentication settings":
      - Enable OAuth 2.0
      - Type of App: Web App
      - Callback URI: https://yourdomain.com/api/x/callback
      - Website URL: https://yourdomain.com
   4. Scopes needed: tweet.read  tweet.write  users.read  offline.access
   5. Copy Client ID and Client Secret to your .env
*/