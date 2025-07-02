import FirebaseService from '../firebase-config.js';

class AdminDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.events = {};
        this.bookings = [];
        this.allBookings = [];
        this.filteredBookings = [];
        this.firebaseService = null;
        this.currentEventId = null;
        this.currentEventData = null;
        this.listenersSetup = false;
        this.dataLoaded = {
            events: false,
            bookings: false
        };
        this.init();
    }

    async init() {
        // Simple auth check - if not logged in, redirect immediately
        try {
            this.firebaseService = new FirebaseService();
            const isAuthenticated = await this.firebaseService.isAuthenticated();
            
            if (!isAuthenticated) {
                window.location.href = 'admin-login.html';
                return;
            }
        } catch (error) {
            // If auth check fails, redirect to login
            window.location.href = 'admin-login.html';
            return;
        }

        // Only continue if authenticated
        this.showDashboard();
        this.bindEvents();
        this.loadDataProgressively();
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
                this.filteredBookings = result.bookings;
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

        const seatMapEventSelect = document.getElementById('seatMapEventSelect');
        if (seatMapEventSelect) seatMapEventSelect.addEventListener('change', (e) => {
            this.handleSeatMapEventChange(e.target.value);
        });

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
        
        // Monitor auth state - redirect if logged out
        this.firebaseService.onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = 'admin-login.html';
            }
        });

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
            if (this.firebaseService) await this.firebaseService.logout();
        } catch (error) {}
        window.location.href = 'admin-login.html';
    }

    switchPage(page) {
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
        
        const totalConfirmedBookings = this.allBookings.filter(
            booking => booking.status === 'confirmed'
        ).length;
        
        const totalEvents = Object.keys(this.events).length;
        const totalSeats = totalEvents * 100;
        const totalAvailable = Math.max(0, totalSeats - totalConfirmedBookings);
        const totalBooked = totalConfirmedBookings;
        
        const totalRevenue = this.allBookings
            .filter(booking => booking.status === 'confirmed')
            .reduce((sum, booking) => sum + (booking.price || 0), 0);
        
        this.animateStatUpdate('availableSeats', totalAvailable);
        this.animateStatUpdate('bookedSeats', totalBooked);
        this.animateStatUpdate('todayRevenue', `₱${totalRevenue.toLocaleString()}`);
        this.updateSeatMiniGrid();
    }

    updateSeatMiniGrid(selectedEventId = null) {
        const miniGrid = document.getElementById('seatMiniGrid');
        if (!miniGrid) return;
        
        miniGrid.innerHTML = '';
        
        const totalEvents = Object.keys(this.events).length;
        
        if (totalEvents === 0) {
            miniGrid.innerHTML = `
                <div class="text-center py-3" style="grid-column: 1 / -1;">
                    <i class="fas fa-calendar-plus text-muted" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    <p class="text-muted mt-2 mb-0 small">No events to display</p>
                </div>
            `;
            return;
        }
        
        let eventToShow;
        if (selectedEventId && this.events[selectedEventId]) {
            eventToShow = this.events[selectedEventId];
        } else if (!selectedEventId) {
            this.showEmptySeatMap();
            return;
        } else {
            return;
        }
        
        if (eventToShow) {
            const eventBookings = this.allBookings.filter(
                booking => booking.eventId === eventToShow.id && booking.status === 'confirmed'
            );
            
            const bookedSeats = eventBookings.map(b => b.seatNumber);
            
            for (let i = 1; i <= 50; i++) {
                const miniSeat = document.createElement('div');
                const isBooked = bookedSeats.includes(i);
                
                miniSeat.className = `mini-seat ${isBooked ? 'booked' : 'available'}`;
                miniSeat.textContent = i;
                miniSeat.title = `Seat ${i} - ${isBooked ? 'Booked' : 'Available'}`;
                
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
        const name = document.getElementById('eventName')?.value.trim();
        const date = document.getElementById('eventDate')?.value;
        const price = parseInt(document.getElementById('eventPrice')?.value, 10);

        if (!name || !date || isNaN(price) || price < 0) {
            this.showError('Please fill in all required fields with valid data.');
            return;
        }

        try {
            const eventData = { name, date, price };
            const result = await this.firebaseService.createEvent(eventData);
            if (result.success) {
                const modalEl = document.getElementById('addEventModal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modal.hide();
                }
                const form = document.getElementById('addEventForm');
                if (form) form.reset();
                this.showToast('Event created successfully!', 'success');
                setTimeout(() => {
                    this.loadEventsAsync().then(() => {
                        this.handleEventsLoaded();
                        this.loadDataProgressively();
                    });
                }, 500);
            } else {
                this.showError('Failed to create event: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            this.showError('Error creating event: ' + error.message);
        }
    }

    getBookingDate(booking) {
        const possibleDates = [
            booking.createdAt,
            booking.timestamp,
            booking.dateCreated,
            booking.bookingDate,
            booking.updatedAt
        ];
        
        for (const dateValue of possibleDates) {
            if (dateValue) {
                if (dateValue.seconds) {
                    return new Date(dateValue.seconds * 1000);
                }
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
        
        return new Date();
    }

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
            .slice(0, 8);
        
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
            .slice(0, 10)
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
        this.filteredBookings = [...this.allBookings];
        this.updateKPIs();
        this.loadRecordsTable();
        this.updateEventFilter();
    }

    updateKPIs() {
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

    applyRecordFilters() {
        const recordTypeFilter = document.getElementById('recordTypeFilter')?.value || 'all';
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;
        const searchRecords = document.getElementById('searchRecords')?.value.toLowerCase() || '';

        let filtered = [...this.allBookings];

        if (recordTypeFilter !== 'all') {
            filtered = filtered.filter(booking => booking.status === recordTypeFilter);
        }

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

        this.filteredBookings = filtered;
        this.updateKPIs();
        this.loadRecordsTable();
        
        this.showToast(`Found ${filtered.length} records`, 'info');
    }

    resetRecordFilters() {
        const recordTypeFilter = document.getElementById('recordTypeFilter');
        const dateFrom = document.getElementById('dateFrom');
        const dateTo = document.getElementById('dateTo');
        const searchRecords = document.getElementById('searchRecords');
        
        if (recordTypeFilter) recordTypeFilter.value = 'all';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (searchRecords) searchRecords.value = '';
        
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
        if (!date || isNaN(date.getTime())) {
            return 'Unknown';
        }
        
        const now = new Date();
        
        if (date.seconds) {
            date = new Date(date.seconds * 1000);
        }
        
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const bookingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.floor((nowDate - bookingDate) / (1000 * 60 * 60 * 24));
        
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMs < 0) {
            return 'Future';
        }
        
        if (diffDays === 0) {
            if (diffMins < 1) return 'Just now';
            else if (diffMins < 60) return `${diffMins}m ago`;
            else return `${diffHours}h ago`;
        }
        
        if (diffDays === 1) return '1 day ago';
        else if (diffDays < 7) return `${diffDays} days ago`;
        else if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        else if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        else return `${Math.floor(diffDays / 365)} years ago`;
    }

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
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});