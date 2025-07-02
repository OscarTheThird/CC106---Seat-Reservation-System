import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDlKjjqPI2XAjeqzaRZ3nqW3jlQY69XWqg",
    authDomain: "seat-reservation-system-8e281.firebaseapp.com",
    projectId: "seat-reservation-system-8e281",
    storageBucket: "seat-reservation-system-8e281.firebasestorage.app",
    messagingSenderId: "817017717381",
    appId: "1:817017717381:web:c83d6aac1cea6bdf735fec",
    measurementId: "G-Z6Y9T1Q2B1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Demo credentials
const DEMO_ADMIN = {
    email: 'admin@seatreservation.com',
    password: 'admin123456'
};

// Firebase Service Class
class FirebaseService {
    constructor() {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.isInitialized = false;
        
        onAuthStateChanged(this.auth, (user) => {
            this.currentUser = user;
            if (!this.isInitialized) {
                this.isInitialized = true;
                this.onAuthStateChanged(user);
            }
        });
    }

    // Auth Methods
    async loginAdmin(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            if (this.isDemoAdmin(email, password) && this.isUserNotFoundError(error)) {
                return await this.createDemoAdmin(email, password);
            }
            if (this.isDemoAdmin(email, password) && this.isInvalidCredentialError(error)) {
                return await this.createDemoAdmin(email, password);
            }
            return { success: false, error: error.message };
        }
    }

    async createDemoAdmin(email, password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            await this.initializeSampleData();
            return { success: true, user: userCredential.user, isNewUser: true };
        } catch (createError) {
            if (createError.code === 'auth/email-already-in-use') {
                try {
                    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
                    return { success: true, user: userCredential.user };
                } catch (retryError) {
                    return { success: false, error: `Demo admin exists but login failed: ${retryError.message}` };
                }
            }
            return { success: false, error: createError.message };
        }
    }

    isDemoAdmin(email, password) {
        return email === DEMO_ADMIN.email && password === DEMO_ADMIN.password;
    }

    isUserNotFoundError(error) {
        return error.code === 'auth/user-not-found' || 
               error.message.includes('user-not-found');
    }

    isInvalidCredentialError(error) {
        return error.code === 'auth/invalid-credential' || 
               error.code === 'auth/wrong-password' ||
               error.message.includes('invalid-credential') ||
               error.message.includes('wrong-password');
    }

    async logout() {
        try {
            await signOut(this.auth);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==================== EVENTS ====================
    async createEvent(eventData) {
        try {
            const docRef = await addDoc(collection(this.db, 'events'), {
                ...eventData,
                bookedSeats: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getEvents() {
        try {
            const querySnapshot = await getDocs(
                query(collection(this.db, 'events'), orderBy('createdAt', 'desc'))
            );
            const events = {};
            querySnapshot.forEach((doc) => {
                events[doc.id] = {
                    id: doc.id,
                    ...doc.data()
                };
            });
            return { success: true, events };
        } catch (error) {
            console.error("Error in getEvents:", error);
            return { success: false, error: error.message, events: {} };
        }
    }

    async updateEvent(eventId, updateData) {
        try {
            const eventRef = doc(this.db, 'events', eventId);
            await updateDoc(eventRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteEvent(eventId) {
        try {
            await runTransaction(this.db, async (transaction) => {
                const eventRef = doc(this.db, 'events', eventId);
                transaction.delete(eventRef);
                const bookingsQuery = query(
                    collection(this.db, 'bookings'), 
                    where('eventId', '==', eventId)
                );
                const bookingsSnapshot = await getDocs(bookingsQuery);
                bookingsSnapshot.forEach((bookingDoc) => {
                    transaction.delete(doc(this.db, 'bookings', bookingDoc.id));
                });
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==================== BOOKINGS ====================
    async createBooking(bookingData) {
        try {
            const result = await runTransaction(this.db, async (transaction) => {
                // Check if seat is already booked
                const bookingsQuery = query(
                    collection(this.db, 'bookings'),
                    where('eventId', '==', bookingData.eventId),
                    where('seatNumber', '==', bookingData.seatNumber),
                    where('status', '==', 'confirmed')
                );
                const existingBookings = await getDocs(bookingsQuery);
                if (!existingBookings.empty) {
                    throw new Error(`Seat ${bookingData.seatNumber} is already booked`);
                }
                // Create the booking
                const bookingRef = doc(collection(this.db, 'bookings'));
                const newBooking = {
                    ...bookingData,
                    id: bookingRef.id,
                    status: 'confirmed',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                transaction.set(bookingRef, newBooking);
                return { success: true, booking: newBooking };
            });
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getBookings(filters = {}) {
        try {
            let bookingQuery = query(
                collection(this.db, 'bookings'), 
                orderBy('createdAt', 'desc')
            );
            if (filters.eventId) {
                bookingQuery = query(
                    collection(this.db, 'bookings'),
                    where('eventId', '==', filters.eventId),
                    where('status', '==', 'confirmed'),
                    orderBy('createdAt', 'desc')
                );
            }
            const querySnapshot = await getDocs(bookingQuery);
            const bookings = [];
            querySnapshot.forEach((doc) => {
                const bookingData = doc.data();
                bookings.push({
                    id: doc.id,
                    ...bookingData
                });
            });
            return { success: true, bookings };
        } catch (error) {
            console.error("Error in getBookings:", error);
            return { success: false, error: error.message, bookings: [] };
        }
    }

    async updateBooking(bookingId, updateData) {
        try {
            const bookingRef = doc(this.db, 'bookings', bookingId);
            await updateDoc(bookingRef, {
                ...updateData,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteBooking(bookingId) {
        try {
            const bookingRef = doc(this.db, 'bookings', bookingId);
            await deleteDoc(bookingRef);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ==================== REAL-TIME LISTENERS ====================
    onEventsChange(callback) {
        try {
            const unsubscribe = onSnapshot(
                query(collection(this.db, 'events'), orderBy('createdAt', 'desc')),
                (snapshot) => {
                    const events = {};
                    snapshot.forEach((doc) => {
                        events[doc.id] = {
                            id: doc.id,
                            ...doc.data()
                        };
                    });
                    callback(events);
                },
                (error) => { console.error("Error in onEventsChange:", error);}
            );
            return unsubscribe;
        } catch (error) {
            console.error("Error in onEventsChange outer:", error);
        }
    }

    onBookingsChange(callback) {
        try {
            const unsubscribe = onSnapshot(
                query(collection(this.db, 'bookings'), orderBy('createdAt', 'desc')),
                (snapshot) => {
                    const bookings = [];
                    snapshot.forEach((doc) => {
                        const bookingData = doc.data();
                        bookings.push({
                            id: doc.id,
                            ...bookingData
                        });
                    });
                    callback(bookings);
                },
                (error) => { console.error("Error in onBookingsChange:", error);}
            );
            return unsubscribe;
        } catch (error) {
            console.error("Error in onBookingsChange outer:", error);
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    onAuthStateChanged(user) {
        // Override this method in implementing classes
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    // Initialize sample data (call this after first login)
    async initializeSampleData() {
        try {
            const eventsResult = await this.getEvents();
            if (eventsResult.success && Object.keys(eventsResult.events).length > 0) {
                return { success: true, message: 'Sample data already exists' };
            }
            const sampleEvents = [
                {
                    name: "borac - 6/28/2025",
                    date: "2025-06-28T19:00",
                    price: 2222
                },
                {
                    name: "Summer Concert - July 15, 2025",
                    date: "2025-07-15T19:00",
                    price: 750
                },
                {
                    name: "Theater Play - July 20, 2025", 
                    date: "2025-07-20T20:00",
                    price: 500
                },
                {
                    name: "Basketball Game - July 25, 2025",
                    date: "2025-07-25T18:00", 
                    price: 1200
                },
                {
                    name: "Tech Conference - July 30, 2025",
                    date: "2025-07-30T09:00",
                    price: 300
                }
            ];
            let createdCount = 0;
            for (const eventData of sampleEvents) {
                const result = await this.createEvent(eventData);
                if (result.success) {
                    createdCount++;
                }
            }
            return { success: true, message: `Sample data created successfully: ${createdCount} events` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

window.FirebaseService = FirebaseService;
export default FirebaseService;