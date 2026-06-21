import admin from 'firebase-admin';
import { readFileSync } from 'fs';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(
            JSON.parse(
                readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!, 'utf8')
            )
        ),
    });
}

export const firebaseAdmin = admin;