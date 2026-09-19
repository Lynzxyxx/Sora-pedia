import admin from 'firebase-admin';

const DEFAULT_DB_URL = 'https://sorapay-53345-default-rtdb.asia-southeast1.firebasedatabase.app';

function init() {
  if (admin.apps.length) return;
  let cred;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    cred = admin.credential.cert(sa);
  } else {
    cred = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, '')
    });
  }
  admin.initializeApp({
    credential: cred,
    databaseURL: process.env.FIREBASE_DATABASE_URL || DEFAULT_DB_URL
  });
}

export function db() {
  init();
  return admin.database();
}
