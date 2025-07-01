
import FirebaseService from './firebase-config.js';

class SeatReservationSystem {
    constructor() {
        this.firebaseService = null;
        this.events = {};
        this.allBookings = [];
        this.selectedSeat = null;
        this.currentEvent = null;
        this.currentEventData = null;
        this.listenersSetup = false;
        this.init();
    }
    
    async init() {
        try {
            this.firebaseService = new FirebaseService();
        } catch (error) {
            this.showError('Firebase connection failed. Please refresh the page.');
            return;
        }
        this.bindEvents();
        await this.loadEvents();
        await this.loadAllBookings();
        this.setupRealtimeListeners();
        this.addDebugPanel();
    }
    
    bindEvents() {
        const eventSelect = document.getElementById('eventSelect');
        if (eventSelect) {
            eventSelect.addEventListener('change', (e) => {
                this.handleEventChange(e.target.value);
            });
        }
        const confirmBookingBtn = document.getElementById('confirmBooking');
        if (confirmBookingBtn) {
            confirmBookingBtn.addEventListener('click', () => {
                this.handleBookingConfirmation();
            });
        }
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) {
            bookingForm.addEventListener('input', () => {
                this.validateForm();
            });
        }
        ['fullName', 'email', 'phone'].forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => this.validateForm());
                field.addEventListener('blur', () => this.validateForm());
            }
        });
    }

    async loadEvents() {
        try {
            if (!this.firebaseService) {
                this.showError('Firebase service not available');
                return;
            }
            this.showLoading(true);
            const result = await this.firebaseService.getEvents();
            if (result && result.success) {
                this.events = result.events;
                if (Object.keys(this.events).length === 0) this.showNoEventsMessage();
                else this.populateEventSelect();
            } else {
                this.showError('Failed to load events from database');
            }
        } catch (error) {
            this.showError('Error connecting to database');
        } finally {
            this.showLoading(false);
        }
    }

    async loadAllBookings() {
        try {
            const result = await this.firebaseService.getBookings();
            if (result && result.success) {
                this.allBookings = result.bookings.filter(booking => booking.status === 'confirmed');
            } else {
                this.allBookings = [];
            }
        } catch (error) {
            this.allBookings = [];
        }
    }

    showNoEventsMessage() {
        const eventSelect = document.getElementById('eventSelect');
        if (eventSelect) {
            eventSelect.innerHTML = '<option value="">No events available - Admin must create events first</option>';
        }
        const eventMessage = document.getElementById('eventMessage');
        if (eventMessage) {
            eventMessage.innerHTML = `
                <div class="alert alert-warning text-center">
                    <i class="fas fa-calendar-times me-2"></i>
                    <strong>No events available!</strong><br>
                    Please contact the administrator to create events first.
                </div>
            `;
        }
    }

    populateEventSelect() {
        const eventSelect = document.getElementById('eventSelect');
        if (!eventSelect) return;
        eventSelect.innerHTML = '<option value="">Choose an event...</option>';
        Object.entries(this.events).forEach(([id, event]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = event.name;
            eventSelect.appendChild(option);
        });
    }

    setupRealtimeListeners() {
        if (!this.firebaseService || this.listenersSetup) return;
        this.firebaseService.onEventsChange((events) => {
            this.events = events;
            if (Object.keys(events).length === 0) this.showNoEventsMessage();
            else this.populateEventSelect();
            if (this.currentEvent && this.events[this.currentEvent]) {
                this.refreshCurrentEventDisplay();
            }
        });
        this.firebaseService.onBookingsChange((bookings) => {
            this.allBookings = bookings.filter(booking => booking.status === 'confirmed');
            if (this.currentEvent) this.refreshCurrentEventDisplay();
        });
        this.listenersSetup = true;
    }

    refreshCurrentEventDisplay() {
        if (!this.currentEvent || !this.events[this.currentEvent]) return;
        this.updateCurrentEventData();
        this.refreshSeatLayout();
        this.updateEventDetails();
        this.updateDebugInfo();
    }

    updateCurrentEventData() {
        if (!this.currentEvent) return;
        const eventBookings = this.allBookings.filter(booking => 
            booking.eventId === this.currentEvent && booking.status === 'confirmed'
        );
        const bookedSeats = eventBookings.map(booking => booking.seatNumber);
        if (this.currentEventData) {
            this.currentEventData.bookedSeats = bookedSeats;
        }
    }

    handleEventChange(eventId) {
        const eventMessage = document.getElementById('eventMessage');
        const seatLayout = document.getElementById('seatLayout');
        if (!eventId) {
            if (eventMessage) eventMessage.style.display = 'block';
            if (seatLayout) seatLayout.style.display = 'none';
            this.hideEventDetails();
            this.currentEvent = null;
            this.currentEventData = null;
            return;
        }
        this.currentEvent = eventId;
        this.currentEventData = { ...this.events[eventId] };
        if (eventMessage) eventMessage.style.display = 'none';
        if (seatLayout) seatLayout.style.display = 'block';
        this.updateCurrentEventData();
        this.generateSeatLayout();
        this.updateEventDetails();
        if (this.isEventFullyBooked()) this.showFullyBookedMessage();
        this.updateDebugInfo();
    }

    updateEventDetails() {
        const eventDetailsDiv = document.getElementById('eventDetails');
        const eventDateEl = document.getElementById('eventDate');
        const eventPriceEl = document.getElementById('eventPrice');
        const availableSeatsEl = document.getElementById('availableSeats');
        if (!this.currentEventData || !eventDetailsDiv) return;
        const totalSeats = 100;
        const bookedSeats = this.currentEventData.bookedSeats ? this.currentEventData.bookedSeats.length : 0;
        const availableCount = totalSeats - bookedSeats;
        let formattedDate = 'Not specified';
        if (this.currentEventData.date) {
            const date = new Date(this.currentEventData.date);
            formattedDate = date.toLocaleDateString();
        }
        if (eventDateEl) eventDateEl.textContent = formattedDate;
        if (eventPriceEl) eventPriceEl.textContent = `₱${(this.currentEventData.price || 0).toLocaleString()}`;
        if (availableSeatsEl) availableSeatsEl.textContent = `${availableCount}/100`;
        eventDetailsDiv.style.display = 'block';
    }

    hideEventDetails() {
        const eventDetailsDiv = document.getElementById('eventDetails');
        if (eventDetailsDiv) eventDetailsDiv.style.display = 'none';
    }

    generateSeatLayout() {
        const seatGrid = document.getElementById('seatGrid');
        if (!this.currentEventData || !seatGrid) return;
        seatGrid.innerHTML = '';
        const bookedSeats = this.currentEventData.bookedSeats || [];
        for (let i = 1; i <= 100; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.textContent = i;
            seat.dataset.seatNumber = i;
            if (bookedSeats.includes(i)) {
                seat.classList.add('booked');
                seat.title = `Seat ${i} - Already Booked`;
                seat.addEventListener('click', () => this.handleBookedSeatClick(i));
            } else {
                seat.classList.add('available');
                seat.title = `Seat ${i} - Available`;
                seat.addEventListener('click', () => this.selectSeat(i));
            }
            seatGrid.appendChild(seat);
        }
    }

    refreshSeatLayout() {
        if (this.currentEvent && this.currentEventData) {
            this.updateCurrentEventData();
            this.generateSeatLayout();
        }
    }

    isEventFullyBooked() {
        if (!this.currentEventData) return false;
        const bookedSeats = this.currentEventData.bookedSeats || [];
        return bookedSeats.length >= 100;
    }
    
    selectSeat(seatNumber) {
        if (!this.isSeatAvailable(seatNumber)) {
            this.showError(`Seat ${seatNumber} is no longer available`);
            this.refreshSeatLayout();
            return;
        }
        document.querySelectorAll('.seat.selected').forEach(seat => {
            seat.classList.remove('selected');
            seat.classList.add('available');
        });
        const seatElement = document.querySelector(`[data-seat-number="${seatNumber}"]`);
        if (seatElement && seatElement.classList.contains('available')) {
            seatElement.classList.remove('available');
            seatElement.classList.add('selected');
            this.selectedSeat = seatNumber;
            this.showBookingModal();
        } else {
            this.showError(`Seat ${seatNumber} is not available for booking`);
            this.refreshSeatLayout();
        }
    }

    isSeatAvailable(seatNumber) {
        if (!this.currentEventData) return false;
        const bookedSeats = this.currentEventData.bookedSeats || [];
        if (bookedSeats.includes(seatNumber)) {
            return false;
        }
        return true;
    }

    handleBookedSeatClick(seatNumber) {
        this.showToast(`Seat ${seatNumber} is already booked and unavailable`, 'warning');
    }
    
    showBookingModal() {
        const selectedSeatSpan = document.getElementById('selectedSeat');
        const selectedEventSpan = document.getElementById('selectedEvent');
        const selectedPriceSpan = document.getElementById('selectedPrice');
        if (selectedSeatSpan) selectedSeatSpan.textContent = `Seat ${this.selectedSeat}`;
        if (selectedEventSpan && this.currentEventData) selectedEventSpan.textContent = this.currentEventData.name || 'Unknown Event';
        if (selectedPriceSpan && this.currentEventData) selectedPriceSpan.textContent = `₱${(this.currentEventData.price || 0).toLocaleString()}`;
        const bookingModal = new bootstrap.Modal(document.getElementById('bookingModal'));
        bookingModal.show();
        const bookingForm = document.getElementById('bookingForm');
        if (bookingForm) bookingForm.reset();
        this.validateForm();
    }
    
    showFullyBookedMessage() {
        const seatGrid = document.getElementById('seatGrid');
        if (!seatGrid) return;
        const message = document.createElement('div');
        message.className = 'alert alert-warning text-center mt-3';
        message.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Sorry!</strong> This event is fully booked. Please check other events.
        `;
        seatGrid.appendChild(message);
    }
    
    validateForm() {
        const fullName = document.getElementById('fullName')?.value.trim() || '';
        const email = document.getElementById('email')?.value.trim() || '';
        const phone = document.getElementById('phone')?.value.trim() || '';
        const confirmBtn = document.getElementById('confirmBooking');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[\+]?[0-9]{10,15}$/;
        const isNameValid = fullName.length >= 2;
        const isEmailValid = emailRegex.test(email);
        const isPhoneValid = phoneRegex.test(phone.replace(/\s+/g, ''));
        const isValid = isNameValid && isEmailValid && isPhoneValid;
        if (confirmBtn) {
            confirmBtn.disabled = !isValid;
            if (isValid) {
                confirmBtn.classList.remove('btn-secondary');
                confirmBtn.classList.add('btn-success');
            } else {
                confirmBtn.classList.remove('btn-success');
                confirmBtn.classList.add('btn-secondary');
            }
        }
        return isValid;
    }
    
    async handleBookingConfirmation() {
        const fullName = document.getElementById('fullName')?.value.trim();
        const email = document.getElementById('email')?.value.trim();
        const phone = document.getElementById('phone')?.value.trim();
        if (!this.validateForm()) {
            this.showError('Please fill in all required fields correctly');
            return;
        }
        if (!this.selectedSeat || !this.currentEvent) {
            this.showError('Please select a seat first');
            return;
        }
        const bookingData = {
            fullName,
            email,
            phone,
            seatNumber: this.selectedSeat,
            eventId: this.currentEvent,
            eventName: this.currentEventData.name,
            price: this.currentEventData.price || 0
        };
        await this.processBooking(bookingData);
    }
    
    async processBooking(bookingData) {
        try {
            if (!this.isSeatAvailable(this.selectedSeat)) {
                this.showError(`Seat ${this.selectedSeat} is no longer available. Please select another seat.`);
                const bookingModalEl = document.getElementById('bookingModal');
                const bookingModal = bootstrap.Modal.getInstance(bookingModalEl);
                if (bookingModal) bookingModal.hide();
                this.refreshSeatLayout();
                this.selectedSeat = null;
                return;
            }
            this.showLoadingModal(true);
            const confirmBtn = document.getElementById('confirmBooking');
            if (confirmBtn) {
                const originalText = confirmBtn.innerHTML;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Processing...';
                confirmBtn.disabled = true;
                const result = await this.firebaseService.createBooking(bookingData);
                if (result.success) {
                    this.allBookings.push({
                        ...result.booking,
                        status: 'confirmed'
                    });
                    if (this.currentEventData.bookedSeats) {
                        this.currentEventData.bookedSeats.push(this.selectedSeat);
                    } else {
                        this.currentEventData.bookedSeats = [this.selectedSeat];
                    }
                    const seatElement = document.querySelector(`[data-seat-number="${this.selectedSeat}"]`);
                    if (seatElement) {
                        seatElement.classList.remove('selected');
                        seatElement.classList.add('booked');
                        seatElement.title = `Seat ${this.selectedSeat} - Just Booked!`;
                        seatElement.replaceWith(seatElement.cloneNode(true));
                        const newSeatElement = document.querySelector(`[data-seat-number="${this.selectedSeat}"]`);
                        if (newSeatElement) {
                            newSeatElement.addEventListener('click', () => this.handleBookedSeatClick(this.selectedSeat));
                        }
                    }
                    const bookingModalEl = document.getElementById('bookingModal');
                    const bookingModal = bootstrap.Modal.getInstance(bookingModalEl);
                    if (bookingModal) bookingModal.hide();
                    this.showSuccessModal(result.booking.id);
                    this.selectedSeat = null;
                    this.updateEventDetails();
                    this.updateDebugInfo();
                } else {
                    if (result.error && result.error.includes('already booked')) {
                        this.showError('This seat has just been booked by someone else. Please select another seat.');
                        this.refreshSeatLayout();
                    } else {
                        this.showError('Booking failed: ' + result.error);
                    }
                }
                confirmBtn.innerHTML = originalText;
                confirmBtn.disabled = false;
            }
        } catch (error) {
            this.showError('An unexpected error occurred. Please try again.');
            this.refreshSeatLayout();
        } finally {
            this.showLoadingModal(false);
        }
    }

    addDebugPanel() {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.className = 'debug-panel';
        debugPanel.innerHTML = `
            <h6>🔍 Debug Info</h6>
            <div id="debugContent">Loading...</div>
            <button class="btn btn-sm btn-secondary mt-2" onclick="this.parentElement.style.display='none'">Hide</button>
        `;
        document.body.appendChild(debugPanel);

        const debugBtn = document.createElement('button');
        debugBtn.className = 'btn btn-sm btn-info debug-btn';
        debugBtn.innerHTML = '<i class="fas fa-bug"></i>';
        debugBtn.title = 'Show Debug Info';
        debugBtn.onclick = () => {
            debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
            this.updateDebugInfo();
        };
        document.body.appendChild(debugBtn);
    }

    updateDebugInfo() {
        const debugContent = document.getElementById('debugContent');
        if (!debugContent) return;
        const bookedSeats = this.currentEventData?.bookedSeats || [];
        const eventBookings = this.allBookings.filter(b => b.eventId === this.currentEvent);
        debugContent.innerHTML = `
            <div><strong>Current Event:</strong> ${this.currentEvent || 'None'}</div>
            <div><strong>Event Name:</strong> ${this.currentEventData?.name || 'N/A'}</div>
            <div><strong>Total Events:</strong> ${Object.keys(this.events).length}</div>
            <div><strong>All Bookings Count:</strong> ${this.allBookings.length}</div>
            <div><strong>Booked Seats:</strong> [${bookedSeats.join(', ')}]</div>
            <div><strong>Event Bookings:</strong> ${eventBookings.length}</div>
            <div><strong>Selected Seat:</strong> ${this.selectedSeat || 'None'}</div>
            <div><strong>Listeners Setup:</strong> ${this.listenersSetup ? 'Yes' : 'No'}</div>
            <hr>
            <div class="small">
                <strong>Recent Bookings:</strong><br>
                ${eventBookings.slice(-3).map(b => 
                    `Seat ${b.seatNumber} - ${b.fullName}`
                ).join('<br>') || 'None'}
            </div>
        `;
    }
    
    showSuccessModal(bookingId) {
        const bookingRefSpan = document.getElementById('bookingReference');
        if (bookingRefSpan) bookingRefSpan.textContent = bookingId;
        const successModal = new bootstrap.Modal(document.getElementById('successModal'));
        successModal.show();
    }

    showLoadingModal(show) {
        const loadingModal = document.getElementById('loadingModal');
        if (!loadingModal) return;
        if (show) new bootstrap.Modal(loadingModal).show();
        else {
            const modalInstance = bootstrap.Modal.getInstance(loadingModal);
            if (modalInstance) modalInstance.hide();
        }
    }

    showLoading(show) {
        document.body.style.cursor = show ? 'wait' : 'default';
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
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SeatReservationSystem();
});