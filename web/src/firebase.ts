import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithPopup,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  type Firestore,
} from 'firebase/firestore'
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)

/** Cloud Functions を使うか（Blaze + Auth 有効後に true） */
export const useCloudFunctions = import.meta.env.VITE_USE_FUNCTIONS === 'true'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let functions: Functions | null = null

export function getFirebase() {
  if (!isFirebaseConfigured) return { app: null, auth: null, db: null, functions: null }
  if (!app) {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    functions = getFunctions(app, 'asia-northeast1')
  }
  return { app, auth, db, functions }
}

export async function ensureAnonymousAuth(): Promise<User | null> {
  const { auth: a } = getFirebase()
  if (!a) return null

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      unsub()
      reject(new Error('Auth timeout'))
    }, 8000)

    const unsub = onAuthStateChanged(a, async (user) => {
      unsub()
      window.clearTimeout(timer)
      try {
        if (user) {
          resolve(user)
          return
        }
        const cred = await signInAnonymously(a)
        resolve(cred.user)
      } catch (e) {
        reject(e)
      }
    })
  })
}

export async function linkGoogleAccount(): Promise<User | null> {
  const { auth: a } = getFirebase()
  if (!a?.currentUser) throw new Error('Not signed in')
  const provider = new GoogleAuthProvider()
  const result = await linkWithPopup(a.currentUser, provider)
  return result.user
}

export async function callStartFishing(baitId: string): Promise<FishingSession | null> {
  const { functions: fns } = getFirebase()
  if (!fns || !useCloudFunctions) return null
  const callable = httpsCallable<{ baitId: string }, { fishing: FishingSession }>(
    fns,
    'startFishing',
  )
  const res = await callable({ baitId })
  return res.data.fishing
}

export async function callClaimFish(): Promise<{
  fishId: string
  sizeCm: number
  isNew: boolean
} | null> {
  const { functions: fns } = getFirebase()
  if (!fns || !useCloudFunctions) return null
  const callable = httpsCallable<
    Record<string, never>,
    { fishId: string; sizeCm: number; isNew: boolean }
  >(fns, 'claimFish')
  const res = await callable({})
  return res.data
}

export type FishingSession = {
  baitId: string
  startedAt: number
  readyAt: number
  claimed: boolean
}

export type CaughtFishRecord = {
  fishId: string
  count: number
  maxSizeCm: number
  lastCaughtAt: number
}

export type UserProfile = {
  name: string
  fishing: FishingSession | null
  caught: Record<string, CaughtFishRecord>
  createdAt: number
  updatedAt: number
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const { db: d } = getFirebase()
  if (!d) return null
  const snap = await getDoc(doc(d, 'users', uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

export async function saveUserProfile(uid: string, profile: UserProfile): Promise<void> {
  const { db: d } = getFirebase()
  if (!d) return
  await setDoc(doc(d, 'users', uid), { ...profile, updatedAt: Date.now() }, { merge: true })
}

export async function updateUserName(uid: string, name: string): Promise<void> {
  const { db: d } = getFirebase()
  if (!d) return
  await updateDoc(doc(d, 'users', uid), { name, updatedAt: Date.now() })
}

export async function fetchMasterFishesFromFirestore(): Promise<unknown[] | null> {
  const { db: d } = getFirebase()
  if (!d) return null
  try {
    const snap = await getDocs(collection(d, 'master_fishes'))
    if (snap.empty) return null
    return snap.docs.map((x) => ({ id: x.id, ...x.data() }))
  } catch {
    return null
  }
}

export { onAuthStateChanged }
