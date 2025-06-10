// Reservation Management System JavaScript

class ReservationSystem {
    constructor() {
        this.reservations = [];
        this.selectedSeats = [];
        this.occupiedSeats = ['A3', 'B5', 'C2', 'D7', 'E1']; // Example occupied seats
        this.nextId = 1;
        this.currentEditId = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.generateSeatMap();
        this.setupDateDefaults();
        this.loadSampleData();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Form submissions
        document.getElementById('reservationForm').addEventListener('submit', (e) => this.handleNewReservation(e));
        document.getElementById('editForm').addEventListener('submit', (e) => this.handleEditReservation(e));

        // Search and filter
        document.getElementById('searchReservations').addEventListener('input', (e) => this.filterReservations());
        document.getElementById('filterStatus').addEventListener('change', (e) => this.filterReservations());
        document.getElementById('filterDate').addEventListener('change', (e) => this.filterReservations());

        // Availability checker
        document.getElementById('checkAvailability').addEventListener('click', () => this.checkAvailability());

        // Modal handling
        document.querySelector('.close').addEventListener('click', () => this.closeEditModal());
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('editModal')) {
                this.closeEditModal();
            }
        });
    }

    setupDateDefaults() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reservationDate').value = today;
        document.getElementById('checkDate').value = today;
        
        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ':' + 
                    now.getMinutes().toString().padStart(2, '0');
        document.getElementById('reservationTime').value = time;
        document.getElementById('checkTime').value = time;
    }

    loadSampleData() {
        // Add some sample reservations
        this.reservations = [
            {
                id: 1,
                customerName: 'John Doe',
                customerEmail: 'john@example.com',
                date: '2025-06-15',
                time: '14:30',
                seats: ['A1', 'A2'],
                paymentMethod: 'card',
                paymentStatus: 'paid',
                status: 'confirmed',
                createdAt: new Date('2025-06-10')
            },
            {
                id: 2,
                customerName: 'Jane Smith',
                customerEmail: 'jane@example.com',
                date: '2025-06-16',
                time: '18:00',
                seats: ['B3', 'B4'],
                paymentMethod: 'cash',
                paymentStatus: 'pending',
                status: 'pending',
                createdAt: new Date('2025-06-11')
            },
            {
                id: 3,
                customerName: 'Mike Johnson',
                customerEmail: 'mike@example.com',
                date: '2025-06-12',
                time: '16:00',
                seats: ['C5'],
                paymentMethod: 'online',
                paymentStatus: 'paid',
                status: 'completed',
                createdAt: new Date('2025-06-08')
            }
        ];
        this.nextId = 4;
        this.renderReservations();
    }

    generateSeatMap() {
        const seatMap = document.querySelector('.seat-map');
        seatMap.innerHTML = '';
        
        const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
        const seatsPerRow = 10;
        
        rows.forEach(row => {
            for (let i = 1; i <= seatsPerRow; i++) {
                const seatId = `${row}${i}`;
                const seat = document.createElement('div');
                seat.className = 'seat';
                seat.textContent = seatId;
                seat.dataset.seatId = seatId;
                
                if (this.occupiedSeats.includes(seatId)) {
                    seat.classList.add('occupied');
                } else {
                    seat.classList.add('available');
                    seat.addEventListener('click', () => this.toggleSeat(seatId));
                }
                
                seatMap.appendChild(seat);
            }
        });
    }

    toggleSeat(seatId) {
        const seat = document.querySelector(`[data-seat-id="${seatId}"]`);
        
        if (seat.classList.contains('occupied')) {
            return; // Can't select occupied seats
        }
        
        if (seat.classList.contains('selected')) {
            // Deselect seat
            seat.classList.remove('selected');
            seat.classList.add('available');
            this.selectedSeats = this.selectedSeats.filter(id => id !== seatId);
        } else {
            // Select seat
            seat.classList.remove('available');
            seat.classList.add('selected');
            this.selectedSeats.push(seatId);
        }
        
        this.updateSelectedSeatsDisplay();
    }

    updateSelectedSeatsDisplay() {
        // Update any display of selected seats if needed
        console.log('Selected seats:', this.selectedSeats);
    }

    switchTab(tabId) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        // Refresh content based on tab
        if (tabId === 'manage-reservations') {
            this.renderReservations();
        }
    }

    handleNewReservation(e) {
        e.preventDefault();
        
        if (this.selectedSeats.length === 0) {
            alert('Please select at least one seat.');
            return;
        }
        
        const formData = new FormData(e.target);
        const reservation = {
            id: this.nextId++,
            customerName: document.getElementById('customerName').value,
            customerEmail: document.getElementById('customerEmail').value,
            date: document.getElementById('reservationDate').value,
            time: document.getElementById('reservationTime').value,
            seats: [...this.selectedSeats],
            paymentMethod: document.getElementById('paymentMethod').value,
            paymentStatus: document.getElementById('paymentStatus').value,
            status: 'confirmed',
            createdAt: new Date()
        };
        
        this.reservations.push(reservation);
        
        // Update occupied seats
        this.occupiedSeats.push(...this.selectedSeats);
        
        // Reset form
        e.target.reset();
        this.selectedSeats = [];
        this.generateSeatMap();
        this.setupDateDefaults();
        
        alert('Reservation created successfully!');
        this.switchTab('manage-reservations');
    }

    renderReservations() {
        const container = document.getElementById('reservationsList');
        
        if (this.reservations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No reservations found</h3>
                    <p>Create your first reservation to get started.</p>
                </div>
            `;
            return;
        }
        
        const filteredReservations = this.getFilteredReservations();
        
        if (filteredReservations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No matching reservations</h3>
                    <p>Try adjusting your search filters.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredReservations.map(reservation => `
            <div class="reservation-item">
                <div class="reservation-header">
                    <div class="reservation-info">
                        <h4>${reservation.customerName}</h4>
                        <p><i class="fas fa-envelope"></i> ${reservation.customerEmail}</p>
                        <p><i class="fas fa-calendar"></i> ${this.formatDate(reservation.date)} at ${reservation.time}</p>
                        <p><i class="fas fa-chair"></i> Seats: ${reservation.seats.join(', ')}</p>
                        <p><i class="fas fa-credit-card"></i> ${reservation.paymentMethod} - ${reservation.paymentStatus}</p>
                    </div>
                    <div class="reservation-status status-${reservation.status}">
                        ${reservation.status}
                    </div>
                </div>
                <div class="reservation-actions">
                    <button class="btn btn-secondary" onclick="reservationSystem.editReservation(${reservation.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    ${reservation.status !== 'completed' ? `
                        <button class="btn btn-success" onclick="reservationSystem.markCompleted(${reservation.id})">
                            <i class="fas fa-check"></i> Complete
                        </button>
                    ` : ''}
                    ${reservation.status !== 'cancelled' ? `
                        <button class="btn btn-danger" onclick="reservationSystem.cancelReservation(${reservation.id})">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    getFilteredReservations() {
        const searchTerm = document.getElementById('searchReservations').value.toLowerCase();
        const statusFilter = document.getElementById('filterStatus').value;
        const dateFilter = document.getElementById('filterDate').value;
        
        return this.reservations.filter(reservation => {
            const matchesSearch = reservation.customerName.toLowerCase().includes(searchTerm) ||
                                reservation.customerEmail.toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter || reservation.status === statusFilter;
            const matchesDate = !dateFilter || reservation.date === dateFilter;
            
            return matchesSearch && matchesStatus && matchesDate;
        });
    }

    filterReservations() {
        this.renderReservations();
    }

    editReservation(id) {
        const reservation = this.reservations.find(r => r.id === id);
        if (!reservation) return;
        
        this.currentEditId = id;
        
        // Populate edit form
        document.getElementById('editReservationId').value = id;
        document.getElementById('editCustomerName').value = reservation.customerName;
        document.getElementById('editCustomerEmail').value = reservation.customerEmail;
        document.getElementById('editDate').value = reservation.date;
        document.getElementById('editTime').value = reservation.time;
        document.getElementById('editSeats').value = reservation.seats.join(', ');
        document.getElementById('editPaymentMethod').value = reservation.paymentMethod;
        document.getElementById('editPaymentStatus').value = reservation.paymentStatus;
        
        document.getElementById('editModal').style.display = 'block';
    }

    handleEditReservation(e) {
        e.preventDefault();
        
        const id = parseInt(document.getElementById('editReservationId').value);
        const reservationIndex = this.reservations.findIndex(r => r.id === id);
        
        if (reservationIndex === -1) return;
        
        const oldReservation = this.reservations[reservationIndex];
        const newSeats = document.getElementById('editSeats').value
            .split(',')
            .map(seat => seat.trim())
            .filter(seat => seat);
        
        // Remove old seats from occupied list
        this.occupiedSeats = this.occupiedSeats.filter(seat => !oldReservation.seats.includes(seat));
        
        // Update reservation
        this.reservations[reservationIndex] = {
            ...oldReservation,
            customerName: document.getElementById('editCustomerName').value,
            customerEmail: document.getElementById('editCustomerEmail').value,
            date: document.getElementById('editDate').value,
            time: document.getElementById('editTime').value,
            seats: newSeats,
            paymentMethod: document.getElementById('editPaymentMethod').value,
            paymentStatus: document.getElementById('editPaymentStatus').value
        };
        
        // Add new seats to occupied list
        this.occupiedSeats.push(...newSeats);
        
        this.closeEditModal();
        this.renderReservations();
        this.generateSeatMap(); // Refresh seat map
        
        alert('Reservation updated successfully!');
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditId = null;
    }

    markCompleted(id) {
        const reservation = this.reservations.find(r => r.id === id);
        if (reservation) {
            reservation.status = 'completed';
            this.renderReservations();
            alert('Reservation marked as completed!');
        }
    }

    cancelReservation(id) {
        if (!confirm('Are you sure you want to cancel this reservation?')) {
            return;
        }
        
        const reservation = this.reservations.find(r => r.id === id);
        if (reservation) {
            reservation.status = 'cancelled';
            
            // Remove seats from occupied list
            this.occupiedSeats = this.occupiedSeats.filter(seat => !reservation.seats.includes(seat));
            
            this.renderReservations();
            this.generateSeatMap(); // Refresh seat map
            alert('Reservation cancelled successfully!');
        }
    }

    checkAvailability() {
        const date = document.getElementById('checkDate').value;
        const time = document.getElementById('checkTime').value;
        
        if (!date || !time) {
            alert('Please select both date and time.');
            return;
        }
        
        const resultsContainer = document.getElementById('availabilityResults');
        
        // Get reservations for the selected date and time
        const conflictingReservations = this.reservations.filter(r => 
            r.date === date && r.time === time && r.status !== 'cancelled'
        );
        
        const occupiedSeatsForDateTime = conflictingReservations.flatMap(r => r.seats);
        
        // Generate availability grid
        const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
        const seatsPerRow = 10;
        let availableCount = 0;
        let occupiedCount = 0;
        
        let gridHTML = '<div class="availability-grid">';
        
        rows.forEach(row => {
            for (let i = 1; i <= seatsPerRow; i++) {
                const seatId = `${row}${i}`;
                const isOccupied = occupiedSeatsForDateTime.includes(seatId);
                
                if (isOccupied) {
                    occupiedCount++;
                    gridHTML += `<div class="availability-seat occupied">${seatId}</div>`;
                } else {
                    availableCount++;
                    gridHTML += `<div class="availability-seat available">${seatId}</div>`;
                }
            }
        });
        
        gridHTML += '</div>';
        
        resultsContainer.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h3>Availability for ${this.formatDate(date)} at ${time}</h3>
                <p><strong>Available:</strong> ${availableCount} seats | <strong>Occupied:</strong> ${occupiedCount} seats</p>
            </div>
            ${gridHTML}
        `;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Initialize the system when DOM is loaded
let reservationSystem;

document.addEventListener('DOMContentLoaded', () => {
    reservationSystem = new ReservationSystem();
});

// Make functions globally accessible for onclick handlers
window.reservationSystem = reservationSystem;