import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

if (!getApps().length) {
    initializeApp({
        credential: cert(
            JSON.parse(
                readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!, 'utf8')
            )
        ),
    });
}

export const firebaseAdmin = { auth: getAuth };