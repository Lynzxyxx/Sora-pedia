import admin from 'firebase-admin';
import { logDbIdentity } from './debug.js';

const DEFAULT_DB_URL = 'https://sorapay-53345-default-rtdb.asia-southeast1.firebasedatabase.app';

function init() {
  if (admin.apps.length) return;
  let cred, projectId;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    cred = admin.credential.cert(sa);
    projectId = sa.project_id;
  } else {
    projectId = process.env.FIREBASE_PROJECT_ID;
    cred = admin.credential.cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, '')
    });
  }
  const databaseURL = process.env.FIREBASE_DATABASE_URL || DEFAULT_DB_URL;
  admin.initializeApp({ credential: cred, databaseURL });
  // FORENSIC (ORDER_DEBUG=1 saja): buktikan server production membaca project
  // & database RTDB yang sama dengan yang dilihat di Firebase Console —
  // tidak pernah mencatat credential/service account.
  logDbIdentity({ databaseURL, projectId });
}

export function db() {
  init();
  return admin.database();
}
