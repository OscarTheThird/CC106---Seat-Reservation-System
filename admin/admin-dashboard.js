import FirebaseService from '../firebase-config.js';

class AdminDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.events = {};
        this.bookings = [];
        this.allBookings = [];
        this.filteredBookings = []; // Add filtered bookings array
        this.firebaseService = null;
        this.currentEventId = null;
        this.currentEventData = null;
        this.listenersSetup = false;
        this.authCheckInterval = null;
        this.dataLoaded = {
            events: false,
            bookings: false
        };
        this.init();
    }

    async init() {
        console.log('🚀 Starting dashboard initialization...');
        
        try {
            this.firebaseService = new FirebaseService();
            console.log('✅ FirebaseService created');
        } catch (error) {
            console.warn('⚠️ Firebase service initialization failed, using fallback auth:', error);
            // Continue with fallback authentication
        }
        
        // SECURITY: Check authentication with fallback logic
        await new Promise(resolve => setTimeout(resolve, 1500)); // Give more time for Firebase
        
        if (!this.checkAuthenticationWithFallback()) {
            console.log('❌ Authentication failed on init, redirecting...');
            this.redirectToLogin();
            return;
        }

        console.log('✅ Authentication passed, initializing dashboard...');
        this.showDashboard();
        this.bindEvents();
        this.setupSecurityMonitoring();
        this.loadDataProgressively();
    }

    checkAuthenticationWithFallback() {
        try {
            // First, check if we have a recent login session
            const hasRecentSession = this.hasRecentLoginSession();
            
            if (hasRecentSession) {
                console.log('✅ Recent login session found, allowing access');
                return true;
            }
            
            // If Firebase is available, use it
            if (this.firebaseService) {
                const firebaseAuth = this.firebaseService.isAuthenticated();
                if (firebaseAuth) {
                    console.log('✅ Firebase authentication confirmed');
                    this.createAuthSession(); // Ensure session exists
                    return true;
                }
            }
            
            // Check for valid auth session as fallback
            const hasAuthSession = this.hasValidAuthSession();
            if (hasAuthSession) {
                console.log('✅ Valid auth session found');
                return true;
            }
            
            console.log('❌ No valid authentication found');
            return false;
        } catch (error) {
            console.error('❌ Auth check error:', error);
            // In case of errors, check for recent session as final fallback
            return this.hasRecentLoginSession();
        }
    }

    hasRecentLoginSession() {
        try {
            const loginTimestamp = localStorage.getItem('adminLoginTimestamp');
            if (!loginTimestamp) {
                return false;
            }
            
            const timestamp = parseInt(loginTimestamp);
            const now = Date.now();
            const timeSinceLogin = now - timestamp;
            
            // Allow access for 10 minutes after login (even if Firebase fails)
            const recentLoginWindow = 10 * 60 * 1000; // 10 minutes
            
            if (timeSinceLogin < recentLoginWindow) {
                console.log(`✅ Recent login detected (${Math.round(timeSinceLogin / 1000)}s ago)`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.log('❌ Error checking recent login:', error);
            return false;
        }
    }

    checkAuthenticationStatus() {
        try {
            // Use the more robust fallback method
            return this.checkAuthenticationWithFallback();
        } catch (error) {
            console.error('❌ Auth check error:', error);
            return this.hasRecentLoginSession(); // Final fallback
        }
    }

    hasValidAuthSession() {
        try {
            const authToken = localStorage.getItem('adminAuthToken');
            
            if (!authToken) {
                return false;
            }
            
            const authData = JSON.parse(authToken);
            
            // Verify basic auth data structure
            if (!authData.timestamp) {
                console.log('🔍 Invalid auth data structure');
                return false;
            }
            
            // Check if auth data is not too old (24 hours) - more lenient
            const now = Date.now();
            const authAge = now - authData.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (authAge > maxAge) {
                console.log('⏰ Auth token expired');
                return false;
            }
            
            return true;
        } catch (error) {
            console.log('❌ Error validating auth session:', error);
            return false;
        }
    }

    createAuthSession() {
        // Create a simple session marker when Firebase auth is valid
        try {
            const authData = {
                timestamp: Date.now(),
                sessionId: this.generateSessionId(),
                created: true
            };
            
            localStorage.setItem('adminAuthToken', JSON.stringify(authData));
            localStorage.setItem('adminLoginTimestamp', Date.now().toString());
            console.log('✅ Auth session created');
        } catch (error) {
            console.warn('Could not create auth session:', error);
        }
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    setupSecurityMonitoring() {
        // More lenient authentication monitoring with Firebase fallback handling
        this.authCheckInterval = setInterval(() => {
            // Only redirect if both Firebase and session checks fail AND no recent login
            if (!this.checkAuthenticationWithFallback()) {
                console.log('🚨 Authentication lost, redirecting to login...');
                this.redirectToLogin();
            }
        }, 60000); // Check every 60 seconds to be even less aggressive
        
        // Monitor page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // When user returns to tab, verify auth (but with delay to avoid loops)
                setTimeout(() => {
                    if (!this.checkAuthenticationWithFallback()) {
                        this.redirectToLogin();
                    }
                }, 2000); // Increased delay
            }
        });
        
        // Monitor storage changes (if auth is cleared in another tab)
        window.addEventListener('storage', (e) => {
            if (e.key === 'adminAuthToken' || e.key === 'adminLoginTimestamp') {
                if (!e.newValue) {
                    // Auth was cleared in another tab, but check if recent login exists
                    setTimeout(() => {
                        if (!this.hasRecentLoginSession()) {
                            console.log('🚨 Auth cleared in another tab');
                            this.redirectToLogin();
                        }
                    }, 2000);
                }
            }
        });

        // Prevent right-click context menu on production (optional)
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        }
    }

    setupDevToolsDetection() {
        // Basic dev tools detection (can be bypassed but adds a layer)
        let devtools = {
            open: false,
            orientation: null
        };
        
        setInterval(() => {
            if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
                if (!devtools.open) {
                    devtools.open = true;
                    console.log('🔧 Developer tools detected');
                    // Optional: Log this event or take action
                }
            } else {
                devtools.open = false;
            }
        }, 500);
    }

    clearAllAuthData() {
        try {
            // Clear all possible auth storage
            localStorage.removeItem('adminAuthToken');
            sessionStorage.removeItem('adminAuthToken');
            localStorage.removeItem('adminLoginTimestamp');
            sessionStorage.removeItem('adminLoginTimestamp');
            
            // Clear any additional session data
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('admin') || key.startsWith('firebase')) {
                    localStorage.removeItem(key);
                }
            });
            
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('admin') || key.startsWith('firebase')) {
                    sessionStorage.removeItem(key);
                }
            });
            
        } catch (error) {
            console.warn('Error clearing auth data:', error);
        }
    }

    redirectToLogin() {
        // Clear all auth data before redirect
        this.clearAllAuthData();
        
        // Set logout timestamp to prevent auto-login
        localStorage.setItem('adminLogoutTimestamp', Date.now().toString());
        
        // Clear intervals
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
        
        // Sign out from Firebase
        if (this.firebaseService) {
            this.firebaseService.signOut().catch(() => {
                // Ignore errors during logout
            });
        }
        
        // Show user-friendly message
        this.showToast('Session expired. Please login again.', 'warning');
        
        // Use replace to prevent back navigation
        setTimeout(() => {
            window.location.replace('admin-login.html');
        }, 1000);
    }

    showDashboard() {
        this.showLoadingStates();
        this.updateCurrentDate();
    }

    updateCurrentDate() {
        const today = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const formattedDate = today.toLocaleDateString('en-US', options);
        
        const dateElement = document.querySelector('.page-subtitle');
        if (dateElement) {
            dateElement.textContent = formattedDate;
        }
    }

    showLoadingStates() {
        this.updateElement('availableSeats', '...');
        this.updateElement('bookedSeats', '...');
        this.updateElement('todayRevenue', '₱...');
    }

    async loadDataProgressively() {
        try {
            const [eventsResult, bookingsResult] = await Promise.all([
                this.loadEventsAsync(),
                this.loadBookingsAsync()
            ]);
            if (eventsResult) this.handleEventsLoaded();
            if (bookingsResult) this.handleBookingsLoaded();
            this.setupRealtimeListeners();
        } catch (error) {
            console.error("Error loading dashboard data:", error);
            this.showError('Error loading dashboard data: ' + (error.message || error));
        }
    }

    async loadEventsAsync() {
        try {
            const result = await this.firebaseService.getEvents();
            if (result && result.success) {
                this.events = result.events;
                this.dataLoaded.events = true;
                return true;
            }
            this.events = {};
            this.dataLoaded.events = true;
            return true;
        } catch (error) {
            console.error("Error loading events:", error);
            this.showError('Error loading events: ' + (error.message || error));
            return false;
        }
    }

    async loadBookingsAsync() {
        try {
            const result = await this.firebaseService.getBookings();
            if (result && result.success) {
                this.allBookings = result.bookings;
                this.bookings = result.bookings;
                this.filteredBookings = result.bookings; // Initialize filtered bookings
                this.dataLoaded.bookings = true;
                return true;
            }
            this.allBookings = [];
            this.bookings = [];
            this.filteredBookings = [];
            this.dataLoaded.bookings = true;
            return true;
        } catch (error) {
            console.error("Error loading bookings:", error);
            this.showError('Error loading bookings: ' + (error.message || error));
            return false;
        }
    }

    handleEventsLoaded() {
        this.updateEventSelects();
        this.updateEventsOverview();
        this.checkIfCanUpdateStats();
    }

    handleBookingsLoaded() {
        this.loadRecentBookings();
        this.loadRecentActivity();
        this.checkIfCanUpdateStats();
    }

    checkIfCanUpdateStats() {
        if (this.dataLoaded.events && this.dataLoaded.bookings) {
            this.updateStatCards();
        }
    }

    bindEvents() {
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchPage(e.target.closest('[data-page]').dataset.page);
            });
        });

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });

        const saveEventBtn = document.getElementById('saveEvent');
        if (saveEventBtn) saveEventBtn.addEventListener('click', () => this.saveNewEvent());

        const adminEventSelect = document.getElementById('adminEventSelect');
        if (adminEventSelect) adminEventSelect.addEventListener('change', (e) => {
            this.handleAdminEventChange(e.target.value);
        });

        // Add seat map event selector
        const seatMapEventSelect = document.getElementById('seatMapEventSelect');
        if (seatMapEventSelect) seatMapEventSelect.addEventListener('change', (e) => {
            this.handleSeatMapEventChange(e.target.value);
        });

        // Add View Full Seats button event listener
        const viewFullSeatsBtn = document.getElementById('viewFullSeatsBtn');
        if (viewFullSeatsBtn) viewFullSeatsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchPage('reservation');
        });

        const applyFiltersBtn = document.getElementById('applyFilters');
        const resetFiltersBtn = document.getElementById('resetFilters');
        if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', () => this.applyRecordFilters());
        if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => this.resetRecordFilters());

        const exportCSVBtn = document.getElementById('exportCSV');
        if (exportCSVBtn) exportCSVBtn.addEventListener('click', () => this.exportToCSV());

        const refreshActivityBtn = document.getElementById('refreshActivity');
        if (refreshActivityBtn) refreshActivityBtn.addEventListener('click', () => this.loadRecentActivity());

        this.setupMobileMenu();
    }

    setupRealtimeListeners() {
        if (!this.firebaseService || this.listenersSetup) return;
        this.firebaseService.onEventsChange((events) => {
            this.events = events;
            this.updateEventSelects();
            this.updateEventsOverview();
            if (this.currentPage === 'dashboard') this.updateStatCards();
            if (this.currentPage === 'reservation' && this.currentEventId) this.refreshCurrentEventDisplay();
        });

        this.firebaseService.onBookingsChange((bookings) => {
            this.allBookings = bookings;
            this.bookings = bookings;
            this.filteredBookings = bookings;
            if (this.currentPage === 'dashboard') {
                this.updateStatCards();
                this.loadRecentBookings();
                this.loadRecentActivity();
            } else if (this.currentPage === 'records') {
                this.loadRecordsData();
            } else if (this.currentPage === 'reservation' && this.currentEventId) {
                this.refreshCurrentEventDisplay();
            }
        });
        this.listenersSetup = true;
    }

    refreshCurrentEventDisplay() {
        if (!this.currentEventId || !this.events[this.currentEventId]) return;
        this.updateCurrentEventData();
        this.generateAdminSeatLayout(this.currentEventId);
    }

    updateCurrentEventData() {
        if (!this.currentEventId) return;
        const eventBookings = this.allBookings.filter(booking => 
            booking.eventId === this.currentEventId && booking.status === 'confirmed'
        );
        const bookedSeats = eventBookings.map(booking => booking.seatNumber);
        if (this.currentEventData) {
            this.currentEventData.bookedSeats = bookedSeats;
        }
    }

    setupMobileMenu() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
        }
    }

    async handleLogout() {
        try {
            console.log('🔓 Logging out admin...');
            
            // Show logout confirmation
            if (!confirm('Are you sure you want to logout?')) {
                return;
            }
            
            // Set logout timestamp to prevent auto-login
            localStorage.setItem('adminLogoutTimestamp', Date.now().toString());
            
            // Clear intervals
            if (this.authCheckInterval) {
                clearInterval(this.authCheckInterval);
            }
            
            // Sign out from Firebase
            if (this.firebaseService) {
                await this.firebaseService.signOut();
            }
            
            // Clear all authentication data
            this.clearAllAuthData();
            
            // Show logout message
            this.showToast('Logged out successfully', 'success');
            
            // Redirect to login page using replace to prevent back navigation
            setTimeout(() => {
                window.location.replace('admin-login.html');
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout even if there's an error
            localStorage.setItem('adminLogoutTimestamp', Date.now().toString());
            this.clearAllAuthData();
            window.location.replace('admin-login.html');
        }
    }

    switchPage(page) {
        // More lenient auth check for page switching
        if (!this.checkAuthenticationWithFallback()) {
            this.redirectToLogin();
            return;
        }
        
        document.querySelectorAll('.page-content').forEach(pageEl => pageEl.classList.add('d-none'));
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) targetPage.classList.remove('d-none');
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) activeLink.classList.add('active');
        this.currentPage = page;
        if (page === 'records') this.loadRecordsData();
        if (page === 'reservation') this.loadReservationData();
    }

    updateStatCards() {
        if (!this.dataLoaded.events || !this.dataLoaded.bookings) return;
        
        // Get total confirmed bookings across ALL events
        const totalConfirmedBookings = this.allBookings.filter(
            booking => booking.status === 'confirmed'
        ).length;
        
        // Calculate totals
        const totalEvents = Object.keys(this.events).length;
        const totalSeats = totalEvents * 100; // 100 seats per event
        const totalAvailable = Math.max(0, totalSeats - totalConfirmedBookings);
        const totalBooked = totalConfirmedBookings;
        
        // Calculate total revenue from confirmed bookings
        const totalRevenue = this.allBookings
            .filter(booking => booking.status === 'confirmed')
            .reduce((sum, booking) => sum + (booking.price || 0), 0);
        
        // Update the display
        this.animateStatUpdate('availableSeats', totalAvailable);
        this.animateStatUpdate('bookedSeats', totalBooked);
        this.animateStatUpdate('todayRevenue', `₱${totalRevenue.toLocaleString()}`);
        this.updateSeatMiniGrid();
    }

    // Main function that updates the seat mini grid display - UPDATED: Removed seat grid label
    updateSeatMiniGrid(selectedEventId = null) {
        const miniGrid = document.getElementById('seatMiniGrid');
        if (!miniGrid) return;
        
        // Clear the container first
        miniGrid.innerHTML = '';
        
        const totalEvents = Object.keys(this.events).length;
        
        // Check if there are any events
        if (totalEvents === 0) {
            miniGrid.innerHTML = `
                <div class="text-center py-3" style="grid-column: 1 / -1;">
                    <i class="fas fa-calendar-plus text-muted" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    <p class="text-muted mt-2 mb-0 small">No events to display</p>
                </div>
            `;
            return;
        }
        
        // Determine which event to show
        let eventToShow;
        if (selectedEventId && this.events[selectedEventId]) {
            // Use the selected event from dropdown
            eventToShow = this.events[selectedEventId];
        } else if (!selectedEventId) {
            // If no event selected, show placeholder
            this.showEmptySeatMap();
            return;
        } else {
            // Invalid event ID
            return;
        }
        
        if (eventToShow) {
            // Get all confirmed bookings for this event
            const eventBookings = this.allBookings.filter(
                booking => booking.eventId === eventToShow.id && booking.status === 'confirmed'
            );
            
            // Extract seat numbers that are booked
            const bookedSeats = eventBookings.map(b => b.seatNumber);
            
            // Create 50 mini seats (5 rows x 10 columns)
            for (let i = 1; i <= 50; i++) {
                const miniSeat = document.createElement('div');
                
                // Determine if seat is booked or available
                const isBooked = bookedSeats.includes(i);
                
                // Set CSS classes and content
                miniSeat.className = `mini-seat ${isBooked ? 'booked' : 'available'}`;
                miniSeat.textContent = i;
                miniSeat.title = `Seat ${i} - ${isBooked ? 'Booked' : 'Available'}`;
                
                // Add to grid
                miniGrid.appendChild(miniSeat);
            }
        }
    }

    animateStatUpdate(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.transition = 'all 0.3s ease';
            element.style.transform = 'scale(1.1)';
            element.textContent = value;
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 300);
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    updateEventSelects() {
        const selects = document.querySelectorAll('#adminEventSelect, #eventFilter, #seatMapEventSelect');
        selects.forEach(select => {
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '<option value="">Choose an event...</option>';
            Object.entries(this.events).forEach(([id, event]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = event.name;
                select.appendChild(option);
            });
            select.value = currentValue;
        });
    }

    async saveNewEvent() {
        // More lenient auth check for operations
        if (!this.checkAuthenticationWithFallback()) {
            this.redirectToLogin();
            return;
        }
        
        const name = document.getElementById('eventName')?.value.trim();
        const date = document.getElementById('eventDate')?.value;
        const price = parseInt(document.getElementById('eventPrice')?.value, 10);

        if (!name || !date || isNaN(price) || price < 0) {
            this.showError('Please fill in all required fields with valid data.');
            return;
        }

        try {
            const eventData = {
                name,
                date,
                price
            };
            
            if (this.firebaseService) {
                const result = await this.firebaseService.createEvent(eventData);
                if (result.success) {
                    // Close the modal
                    const modalEl = document.getElementById('addEventModal');
                    if (modalEl) {
                        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                        modal.hide();
                    }
                    // Reset the form
                    const form = document.getElementById('addEventForm');
                    if (form) form.reset();
                    this.showToast('Event created successfully!', 'success');
                    // Refresh stats and event lists
                    setTimeout(() => {
                        this.loadEventsAsync().then(() => {
                            this.handleEventsLoaded();
                            this.loadDataProgressively();
                        });
                    }, 500);
                } else {
                    this.showError('Failed to create event: ' + (result.error || 'Unknown error'));
                }
            } else {
                this.showError('Firebase service not available. Please refresh the page.');
            }
        } catch (error) {
            this.showError('Error creating event: ' + error.message);
        }
    }

    // Helper method to safely get booking date
    getBookingDate(booking) {
        // Try different possible date fields
        const possibleDates = [
            booking.createdAt,
            booking.timestamp,
            booking.dateCreated,
            booking.bookingDate,
            booking.updatedAt
        ];
        
        for (const dateValue of possibleDates) {
            if (dateValue) {
                // Handle Firebase Timestamp objects
                if (dateValue.seconds) {
                    return new Date(dateValue.seconds * 1000);
                }
                // Handle regular date strings/objects
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
        
        // If no valid date found, return current date as fallback
        return new Date();
    }

    // Update the loadRecentBookings method to use enhanced styling
    loadRecentBookings() {
        const container = document.getElementById('upcomingBookings');
        if (!container) return;
        
        if (this.allBookings.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-calendar-times text-muted" style="font-size: 2.5rem; opacity: 0.5;"></i>
                    <p class="text-muted mt-3 mb-0">No upcoming bookings</p>
                </div>
            `;
            return;
        }
        
        const now = new Date();
        const upcomingBookings = this.allBookings
            .filter(booking => {
                if (booking.status !== 'confirmed') return false;
                const event = this.events[booking.eventId];
                if (!event || !event.date) return false;
                const eventDate = new Date(event.date);
                return eventDate >= now;
            })
            .sort((a, b) => {
                const eventA = this.events[a.eventId];
                const eventB = this.events[b.eventId];
                if (!eventA || !eventB) return 0;
                const dateA = new Date(eventA.date);
                const dateB = new Date(eventB.date);
                return dateA - dateB;
            })
            .slice(0, 8); // Show more items since we have better layout
        
        if (upcomingBookings.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-calendar-times text-muted" style="font-size: 2.5rem; opacity: 0.5;"></i>
                    <p class="text-muted mt-3 mb-0">No upcoming bookings</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = upcomingBookings.map(booking => {
            const event = this.events[booking.eventId];
            const eventName = event?.name || 'Unknown Event';
            const eventDate = this.formatEventDate(event.date);
            
            return `
                <div class="booking-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <div class="me-3">
                                    <i class="fas fa-user-circle text-primary" style="font-size: 1.5rem;"></i>
                                </div>
                                <div>
                                    <h6 class="mb-0 font-weight-bold">${booking.fullName}</h6>
                                    <small class="text-muted">
                                        <i class="fas fa-chair me-1"></i>Seat ${booking.seatNumber} • ${eventName}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-primary px-3 py-2" style="font-size: 0.8rem;">
                                <i class="fas fa-calendar me-1"></i>${eventDate}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Update the loadRecentActivity method for bigger, better content
    loadRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        if (this.allBookings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <p>No recent activity to display</p>
                </div>
            `;
            return;
        }
        
        const activities = this.allBookings
            .sort((a, b) => {
                const dateA = this.getBookingDate(a);
                const dateB = this.getBookingDate(b);
                return dateB - dateA;
            })
            .slice(0, 10) // Show more items for scrolling
            .map(booking => {
                const bookingDate = this.getBookingDate(booking);
                const timeAgo = this.getTimeAgo(bookingDate);
                const event = this.events[booking.eventId];
                
                return {
                    type: booking.status,
                    icon: booking.status === 'confirmed' ? 'fas fa-check-circle' : 
                          booking.status === 'cancelled' ? 'fas fa-times-circle' : 'fas fa-clock',
                    color: booking.status === 'confirmed' ? 'bg-success' : 
                           booking.status === 'cancelled' ? 'bg-danger' : 'bg-warning',
                    text: booking.status === 'confirmed' ? 'Booking Confirmed' : 
                          booking.status === 'cancelled' ? 'Booking Cancelled' : 'Booking Pending',
                    customerName: booking.fullName,
                    email: booking.email || 'No email provided',
                    phone: booking.phone || 'No phone provided',
                    seatNumber: booking.seatNumber,
                    eventName: event ? event.name : 'Unknown Event',
                    amount: booking.price ? `₱${booking.price.toLocaleString()}` : 'N/A',
                    time: timeAgo
                };
            });
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <p>No recent activity to display</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.color}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <strong>${activity.text}</strong>
                    <div class="text-muted">
                        <i class="fas fa-user me-1"></i>${activity.customerName} • 
                        <i class="fas fa-chair me-1"></i>Seat ${activity.seatNumber}
                    </div>
                    <div class="text-muted small">
                        <i class="fas fa-calendar me-1"></i>${activity.eventName} • 
                        <i class="fas fa-money-bill me-1"></i>${activity.amount}
                    </div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }

    // Handle seat map event selection
    handleSeatMapEventChange(eventId) {
        if (!eventId) {
            this.showEmptySeatMap();
            return;
        }
        this.updateSeatMiniGrid(eventId);
    }

    showEmptySeatMap() {
        const miniGrid = document.getElementById('seatMiniGrid');
        if (!miniGrid) return;
        
        miniGrid.innerHTML = `
            <div class="text-center py-3" style="grid-column: 1 / -1;">
                <i class="fas fa-arrow-up text-muted"></i>
                <p class="text-muted mt-2 mb-0 small">Select an event to view seats</p>
            </div>
        `;
    }

    updateEventsOverview() {
        const container = document.getElementById('eventsOverview');
        if (!container) return;
        const eventsList = Object.entries(this.events);
        if (eventsList.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-calendar-times text-muted" style="font-size: 2rem;"></i>
                    <p class="text-muted mt-2">No events created yet</p>
                    <button class="btn btn-success btn-sm" data-bs-toggle="modal" data-bs-target="#addEventModal">
                        Create First Event
                    </button>
                </div>
            `;
            return;
        }
        container.innerHTML = eventsList.map(([eventId, event]) => {
            const eventBookings = this.allBookings.filter(
                booking => booking.eventId === eventId && booking.status === 'confirmed'
            );
            const occupancyRate = (eventBookings.length / 100) * 100;
            return `
                <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                        <strong>${event.name}</strong><br>
                        <small class="text-muted">${eventBookings.length}/100 seats</small>
                    </div>
                    <div class="text-end">
                        <div class="progress" style="width: 60px; height: 8px;">
                            <div class="progress-bar" style="width: ${occupancyRate}%"></div>
                        </div>
                        <small class="text-muted">${occupancyRate.toFixed(0)}%</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadRecordsData() {
        if (!this.dataLoaded.bookings) {
            const tbody = document.getElementById('recordsTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr><td colspan="9" class="text-center">
                        <div class="spinner-border spinner-border-sm" role="status"></div>
                        <span class="ms-2">Loading records...</span>
                    </td></tr>
                `;
            }
            return;
        }
        this.filteredBookings = [...this.allBookings]; // Reset filters when loading
        this.updateKPIs();
        this.loadRecordsTable();
        this.updateEventFilter();
    }

    updateKPIs() {
        // Use filtered bookings for KPIs when filters are applied
        const bookingsToAnalyze = this.filteredBookings;
        const totalBookings = bookingsToAnalyze.length;
        const confirmed = bookingsToAnalyze.filter(b => b.status === 'confirmed').length;
        const cancelled = bookingsToAnalyze.filter(b => b.status === 'cancelled').length;
        const totalRevenue = bookingsToAnalyze.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + (b.price || 0), 0);
        const cancelledPercent = totalBookings > 0 ? ((cancelled / totalBookings) * 100).toFixed(1) : 0;
        
        this.updateElement('totalBookings', totalBookings);
        const cancelledEl = document.getElementById('cancelledBookings');
        const revenueEl = document.getElementById('totalRevenue');
        if (cancelledEl) cancelledEl.innerHTML = `${cancelled} <small>(${cancelledPercent}%)</small>`;
        if (revenueEl) revenueEl.textContent = `₱${totalRevenue.toLocaleString()}`;
    }

    updateEventFilter() {
        const eventFilter = document.getElementById('eventFilter');
        if (!eventFilter) return;
        const currentValue = eventFilter.value;
        eventFilter.innerHTML = '<option value="all">All Events</option>';
        Object.entries(this.events).forEach(([eventId, event]) => {
            const option = document.createElement('option');
            option.value = eventId;
            option.textContent = event.name;
            eventFilter.appendChild(option);
        });
        eventFilter.value = currentValue;
    }

    loadRecordsTable() {
        const tbody = document.getElementById('recordsTableBody');
        if (!tbody) return;
        
        if (this.filteredBookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No booking records found</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.filteredBookings.map(booking => {
            const eventName = this.events[booking.eventId]?.name || 'Unknown Event';
            const bookingDate = this.getBookingDate(booking);
            
            return `
                <tr>
                    <td>${booking.id}</td>
                    <td>Booking</td>
                    <td>${booking.fullName}</td>
                    <td>${booking.email || 'N/A'}</td>
                    <td>Seat ${booking.seatNumber}</td>
                    <td>${bookingDate.toLocaleDateString()}</td>
                    <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
                    <td>₱${(booking.price || 0).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="adminDashboard.viewBookingDetails('${booking.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${booking.status === 'confirmed' ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="adminDashboard.cancelBooking('${booking.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ENHANCED: Apply Record Filters - Now includes ID and email search
    applyRecordFilters() {
        const recordTypeFilter = document.getElementById('recordTypeFilter')?.value || 'all';
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;
        const searchRecords = document.getElementById('searchRecords')?.value.toLowerCase() || '';

        // Start with all bookings
        let filtered = [...this.allBookings];

        // Filter by record type (status)
        if (recordTypeFilter !== 'all') {
            filtered = filtered.filter(booking => booking.status === recordTypeFilter);
        }

        // Filter by date range
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(booking => {
                const bookingDate = this.getBookingDate(booking);
                bookingDate.setHours(0, 0, 0, 0);
                return bookingDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(booking => {
                const bookingDate = this.getBookingDate(booking);
                return bookingDate <= toDate;
            });
        }

        // ENHANCED: Filter by search term (ID, customer name, email, seat, or event name)
        if (searchRecords) {
            filtered = filtered.filter(booking => {
                const bookingId = (booking.id || '').toLowerCase();
                const customerName = (booking.fullName || '').toLowerCase();
                const customerEmail = (booking.email || '').toLowerCase();
                const seatNumber = `seat ${booking.seatNumber}`.toLowerCase();
                const eventName = (this.events[booking.eventId]?.name || '').toLowerCase();
                
                return bookingId.includes(searchRecords) ||
                       customerName.includes(searchRecords) || 
                       customerEmail.includes(searchRecords) ||
                       seatNumber.includes(searchRecords) ||
                       eventName.includes(searchRecords);
            });
        }

        // Update filtered bookings and refresh display
        this.filteredBookings = filtered;
        this.updateKPIs();
        this.loadRecordsTable();
        
        this.showToast(`Found ${filtered.length} records`, 'info');
    }

    // FIXED: Reset Record Filters
    resetRecordFilters() {
        const recordTypeFilter = document.getElementById('recordTypeFilter');
        const dateFrom = document.getElementById('dateFrom');
        const dateTo = document.getElementById('dateTo');
        const searchRecords = document.getElementById('searchRecords');
        
        if (recordTypeFilter) recordTypeFilter.value = 'all';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (searchRecords) searchRecords.value = '';
        
        // Reset to show all bookings
        this.filteredBookings = [...this.allBookings];
        this.updateKPIs();
        this.loadRecordsTable();
        
        this.showToast('Filters reset', 'info');
    }

    exportToCSV() {
        if (this.filteredBookings.length === 0) {
            this.showError('No data to export');
            return;
        }
        const csvContent = [
            ['Booking ID', 'Customer', 'Email', 'Phone', 'Event', 'Seat', 'Date', 'Status', 'Price'],
            ...this.filteredBookings.map(booking => {
                const eventName = this.events[booking.eventId]?.name || 'Unknown Event';
                const bookingDate = this.getBookingDate(booking);
                return [
                    booking.id || '',
                    booking.fullName || '',
                    booking.email || '',
                    booking.phone || '',
                    eventName,
                    `Seat ${booking.seatNumber}`,
                    bookingDate.toLocaleDateString(),
                    booking.status || '',
                    booking.price || 0
                ];
            })
        ].map(row => row.join(',')).join('\n');
        this.downloadFile(csvContent, 'bookings.csv', 'text/csv');
        this.showToast('CSV exported successfully', 'success');
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    }

    async viewBookingDetails(bookingId) {
        const booking = this.allBookings.find(b => b.id === bookingId);
        if (booking) {
            const eventName = this.events[booking.eventId]?.name || 'Unknown Event';
            const bookingDate = this.getBookingDate(booking);
            
            alert(`Booking Details:

ID: ${booking.id}
Customer: ${booking.fullName}
Email: ${booking.email}
Phone: ${booking.phone}
Event: ${eventName}
Seat: ${booking.seatNumber}
Date: ${bookingDate.toLocaleDateString()}
Status: ${booking.status}
Price: ₱${(booking.price || 0).toLocaleString()}`);
        }
    }

    async cancelBooking(bookingId) {
        if (!confirm('Are you sure you want to cancel this booking?')) return;
        try {
            const result = await this.firebaseService.updateBooking(bookingId, { status: 'cancelled' });
            if (result.success) {
                const booking = this.allBookings.find(b => b.id === bookingId);
                if (booking) booking.status = 'cancelled';
                
                // Update filtered bookings as well
                const filteredBooking = this.filteredBookings.find(b => b.id === bookingId);
                if (filteredBooking) filteredBooking.status = 'cancelled';
                
                this.loadRecordsTable();
                this.updateKPIs();
                this.updateStatCards();
                this.showToast('Booking cancelled successfully', 'success');
            } else {
                this.showError('Failed to cancel booking');
            }
        } catch (error) {
            this.showError('Error cancelling booking');
        }
    }

    getTimeAgo(date) {
        // Ensure we have a valid date
        if (!date || isNaN(date.getTime())) {
            return 'Unknown';
        }
        
        const now = new Date();
        
        // Handle Firebase Timestamp objects
        if (date.seconds) {
            date = new Date(date.seconds * 1000);
        }
        
        // Calculate difference in days using date objects (not just milliseconds)
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const bookingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.floor((nowDate - bookingDate) / (1000 * 60 * 60 * 24));
        
        // For more precise timing within the same day
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        // Handle future dates
        if (diffMs < 0) {
            return 'Future';
        }
        
        // Same day calculations
        if (diffDays === 0) {
            if (diffMins < 1) return 'Just now';
            else if (diffMins < 60) return `${diffMins}m ago`;
            else return `${diffHours}h ago`;
        }
        
        // Different day calculations
        if (diffDays === 1) return '1 day ago';
        else if (diffDays < 7) return `${diffDays} days ago`;
        else if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        else if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        else return `${Math.floor(diffDays / 365)} years ago`;
    }

    // Helper function to format event dates consistently
    formatEventDate(dateString) {
        if (!dateString) return 'Unknown Date';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        const diffDays = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        else if (diffDays === 1) return 'Tomorrow';
        else if (diffDays === -1) return 'Yesterday';
        else if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
        else if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
        else return date.toLocaleDateString();
    }

    showError(message) {
        this.showToast(message, 'danger');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        toastContainer.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 3000);
    }

    loadReservationData() {
        this.updateEventSelects();
    }

    handleAdminEventChange(eventId) {
        const eventMessage = document.getElementById('adminEventMessage');
        const seatLayout = document.getElementById('adminSeatLayout');
        if (!eventId) {
            if (eventMessage) eventMessage.style.display = 'block';
            if (seatLayout) seatLayout.style.display = 'none';
            this.currentEventId = null;
            this.currentEventData = null;
            return;
        }
        if (eventMessage) eventMessage.style.display = 'none';
        if (seatLayout) seatLayout.style.display = 'block';
        this.currentEventId = eventId;
        this.currentEventData = { ...this.events[eventId] };
        this.updateCurrentEventData();
        this.generateAdminSeatLayout(eventId);
    }

    generateAdminSeatLayout(eventId) {
        const seatGrid = document.getElementById('adminSeatGrid');
        const event = this.events[eventId];
        if (!event || !seatGrid) return;
        seatGrid.innerHTML = '';
        try {
            const eventBookings = this.allBookings.filter(
                booking => booking.eventId === eventId && booking.status === 'confirmed'
            );
            const bookedSeats = eventBookings.map(booking => booking.seatNumber);
            for (let i = 1; i <= 100; i++) {
                const seat = document.createElement('div');
                seat.className = 'seat';
                seat.textContent = i;
                seat.dataset.seatNumber = i;
                seat.dataset.eventId = eventId;
                if (bookedSeats.includes(i)) {
                    seat.classList.add('booked');
                    seat.title = `Seat ${i} - Booked by customer`;
                } else {
                    seat.classList.add('available');
                    seat.title = `Seat ${i} - Available for booking`;
                }
                seatGrid.appendChild(seat);
            }
        } catch (error) {
            console.error('Error generating seat layout:', error);
        }
    }

    // Cleanup method called when dashboard is destroyed
    destroy() {
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
    }
}

// Initialize dashboard with enhanced security
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Secure Admin Dashboard...');
    
    // Create dashboard instance
    const adminDashboard = new AdminDashboard();
    
    // Make it globally available
    window.adminDashboard = adminDashboard;
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.adminDashboard) {
            window.adminDashboard.destroy();
        }
    });
    
    // Additional security: Prevent common navigation attempts
    window.addEventListener('keydown', (e) => {
        // Disable F12 (Developer Tools) on production
        if (e.key === 'F12' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            e.preventDefault();
            return false;
        }
        
        // Disable Ctrl+Shift+I (Developer Tools)
        if (e.ctrlKey && e.shiftKey && e.key === 'I' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            e.preventDefault();
            return false;
        }
        
        // Disable Ctrl+U (View Source)
        if (e.ctrlKey && e.key === 'u' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            e.preventDefault();
            return false;
        }
    });
});