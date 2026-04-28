import { auth, db } from '../firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Consolidated streak update logic.
 * Call after any food/water log to maintain the daily streak.
 */
export async function updateStreak(
  userId: string,
  currentStreak: number | undefined,
  lastLogDate: number | undefined
): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let streak = currentStreak || 0;
  const lastLog = lastLogDate ? new Date(lastLogDate) : null;

  if (!lastLog || lastLog.getTime() < today) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastLog && lastLog.getTime() >= yesterday.getTime() && lastLog.getTime() < today) {
      streak += 1;
    } else {
      streak = 1;
    }

    await setDoc(doc(db, 'users', userId), {
      streak,
      lastLogDate: today
    }, { merge: true });
  }
}

/**
 * Log a glass of water (250ml) for the given user.
 * Returns the newly created doc ID and the item data.
 */
export async function logWater(
  userId: string,
  language: 'en' | 'ar'
): Promise<{ id: string; item: Record<string, unknown> }> {
  const item = {
    userId,
    type: 'water',
    timestamp: Date.now(),
    calories: 0,
    amount: 250,
    details: language === 'ar' ? 'كوب ماء (250 مل)' : '1 Glass of Water (250ml)',
  };

  const docRef = await addDoc(collection(db, 'users', userId, 'history'), item);
  return { id: docRef.id, item };
}
