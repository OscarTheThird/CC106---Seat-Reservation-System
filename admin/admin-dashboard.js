import FirebaseService from '../firebase-config.js';

class AdminDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.events = {};
        this.bookings = [];
        this.allBookings = [];
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
        this.showDashboard();
        this.bindEvents();
        try {
            this.firebaseService = new FirebaseService();
        } catch (error) {
            this.showError('Firebase connection failed. Please refresh the page.');
            return;
        }
        this.loadDataProgressively();
    }

    showDashboard() {
        this.showLoadingStates();
    }

    showLoadingStates() {
        this.updateElement('availableSeats', '...');
        this.updateElement('reservedSeats', '...');
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
                this.dataLoaded.bookings = true;
                return true;
            }
            this.allBookings = [];
            this.bookings = [];
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
            if (this.currentPage === 'dashboard') {
                this.updateStatCards();
                this.loadRecentBookings();
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
        
        // Get total confirmed bookings across ALL events
        const totalConfirmedBookings = this.allBookings.filter(
            booking => booking.status === 'confirmed'
        ).length;
        
        // Calculate totals
        const totalEvents = Object.keys(this.events).length;
        const totalSeats = totalEvents * 100; // 100 seats per event
        const totalAvailable = Math.max(0, totalSeats - totalConfirmedBookings);
        const totalReserved = totalConfirmedBookings;
        
        // Calculate total revenue from confirmed bookings
        const totalRevenue = this.allBookings
            .filter(booking => booking.status === 'confirmed')
            .reduce((sum, booking) => sum + (booking.price || 0), 0);
        
        // Update the display
        this.animateStatUpdate('availableSeats', totalAvailable);
        this.animateStatUpdate('reservedSeats', totalReserved);
        this.animateStatUpdate('todayRevenue', `₱${totalRevenue.toLocaleString()}`);
        this.updateSeatMiniGrid();
    }

    updateSeatMiniGrid() {
        const miniGrid = document.getElementById('seatMiniGrid');
        if (!miniGrid) return;
        miniGrid.innerHTML = '';
        const totalEvents = Object.keys(this.events).length;
        if (totalEvents === 0) {
            miniGrid.innerHTML = '<p class="text-muted small">No events to display</p>';
            return;
        }
        const firstEvent = Object.values(this.events)[0];
        if (firstEvent) {
            const eventBookings = this.allBookings.filter(
                booking => booking.eventId === firstEvent.id && booking.status === 'confirmed'
            );
            const bookedSeats = eventBookings.map(b => b.seatNumber);
            for (let i = 1; i <= 20; i++) {
                const miniSeat = document.createElement('div');
                miniSeat.className = 'mini-seat';
                miniSeat.classList.add(bookedSeats.includes(i) ? 'booked' : 'available');
                miniGrid.appendChild(miniSeat);
            }
            const label = document.createElement('div');
            label.className = 'small text-muted mt-2';
            label.textContent = `${firstEvent.name} (First 20 seats)`;
            miniGrid.appendChild(label);
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
        const selects = document.querySelectorAll('#adminEventSelect, #eventFilter');
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
            const eventData = {
                name,
                date,
                price
            };
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
                        this.loadDataProgressively(); // Optionally re-load all data
                    });
                }, 500);
            } else {
                this.showError('Failed to create event: ' + (result.error || 'Unknown error'));
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
            booking.bookingDate
        ];
        
        for (const dateValue of possibleDates) {
            if (dateValue) {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            }
        }
        
        // If no valid date found, return current date as fallback
        return new Date();
    }

    loadRecentBookings() {
        const container = document.getElementById('upcomingReservations');
        if (!container) return;
        
        if (this.allBookings.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No recent bookings found</p>';
            return;
        }
        
        const recentBookings = this.allBookings
            .filter(booking => booking.status === 'confirmed')
            .sort((a, b) => {
                const dateA = this.getBookingDate(a);
                const dateB = this.getBookingDate(b);
                return dateB - dateA;
            })
            .slice(0, 5);
        
        container.innerHTML = recentBookings.map(booking => {
            const eventName = this.events[booking.eventId]?.name || 'Unknown Event';
            const bookingDate = this.getBookingDate(booking);
            
            return `
                <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <div>
                        <strong>${booking.fullName}</strong><br>
                        <small class="text-muted">Seat ${booking.seatNumber} • ${eventName}</small>
                    </div>
                    <div class="text-end">
                        <small class="text-primary">${bookingDate.toLocaleDateString()}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        if (this.allBookings.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No recent activity</p>';
            return;
        }
        
        const activities = this.allBookings
            .sort((a, b) => {
                const dateA = this.getBookingDate(a);
                const dateB = this.getBookingDate(b);
                return dateB - dateA;
            })
            .slice(0, 5)
            .map(booking => {
                const date = this.getBookingDate(booking);
                const timeAgo = this.getTimeAgo(date);
                
                return {
                    type: booking.status,
                    icon: booking.status === 'confirmed' ? 'fas fa-check-circle' : 'fas fa-clock',
                    color: booking.status === 'confirmed' ? 'bg-success' : 'bg-warning',
                    text: `Booking ${booking.status}`,
                    details: `${booking.fullName} - Seat ${booking.seatNumber}`,
                    time: timeAgo
                };
            });
        
        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.color}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div><strong>${activity.text}</strong></div>
                    <div class="text-muted">${activity.details}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
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
                    <tr><td colspan="8" class="text-center">
                        <div class="spinner-border spinner-border-sm" role="status"></div>
                        <span class="ms-2">Loading records...</span>
                    </td></tr>
                `;
            }
            return;
        }
        this.updateKPIs();
        this.loadRecordsTable();
        this.updateEventFilter();
    }

    updateKPIs() {
        const totalReservations = this.allBookings.length;
        const confirmed = this.allBookings.filter(b => b.status === 'confirmed').length;
        const cancelled = this.allBookings.filter(b => b.status === 'cancelled').length;
        const noShow = this.allBookings.filter(b => b.status === 'no-show').length;
        const totalRevenue = this.allBookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + (b.price || 0), 0);
        const cancelledPercent = totalReservations > 0 ? ((cancelled / totalReservations) * 100).toFixed(1) : 0;
        const noShowPercent = totalReservations > 0 ? ((noShow / totalReservations) * 100).toFixed(1) : 0;
        this.updateElement('totalReservations', totalReservations);
        const cancelledEl = document.getElementById('cancelledReservations');
        const noShowEl = document.getElementById('noShowReservations');
        const revenueEl = document.getElementById('totalRevenue');
        if (cancelledEl) cancelledEl.innerHTML = `${cancelled} <small>(${cancelledPercent}%)</small>`;
        if (noShowEl) noShowEl.innerHTML = `${noShow} <small>(${noShowPercent}%)</small>`;
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
        
        if (this.allBookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No booking records found</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.allBookings.map(booking => {
            const eventName = this.events[booking.eventId]?.name || 'Unknown Event';
            const bookingDate = this.getBookingDate(booking);
            
            return `
                <tr>
                    <td>${booking.id}</td>
                    <td>Reservation</td>
                    <td>${booking.fullName}</td>
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

    resetRecordFilters() {
        const recordTypeFilter = document.getElementById('recordTypeFilter');
        const dateFrom = document.getElementById('dateFrom');
        const dateTo = document.getElementById('dateTo');
        const searchRecords = document.getElementById('searchRecords');
        if (recordTypeFilter) recordTypeFilter.value = 'all';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (searchRecords) searchRecords.value = '';
        this.loadRecordsTable();
        this.showToast('Filters reset', 'info');
    }

    exportToCSV() {
        if (this.allBookings.length === 0) {
            this.showError('No data to export');
            return;
        }
        const csvContent = [
            ['Booking ID', 'Customer', 'Email', 'Phone', 'Event', 'Seat', 'Date', 'Status', 'Price'],
            ...this.allBookings.map(booking => {
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
            return 'Recently';
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        else if (diffMins < 60) return `${diffMins}m ago`;
        else if (diffHours < 24) return `${diffHours}h ago`;
        else return `${diffDays}d ago`;
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
        } catch (error) {}
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});