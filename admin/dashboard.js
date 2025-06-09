// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // Get all navigation items
    const navItems = document.querySelectorAll('.nav-item');
    const signOutBtn = document.getElementById('signOutBtn');
    
    // Handle navigation item clicks
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Get the page name from data attribute
            const pageName = this.getAttribute('data-page');
            
            // Log the navigation (you can replace this with actual navigation logic)
            console.log(`Navigating to: ${pageName}`);
            
            // Add a subtle animation effect
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // Add hover effect with sound-like feedback
        item.addEventListener('mouseenter', function() {
            if (!this.classList.contains('active')) {
                this.style.background = 'rgba(74, 144, 226, 0.1)';
            }
        });
        
        item.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.background = '';
            }
        });
    });
    
    // Handle sign out button click
    signOutBtn.addEventListener('click', function() {
        // Add click animation
        this.style.transform = 'scale(0.95)';
        
        // Show confirmation dialog
        const confirmSignOut = confirm('Are you sure you want to sign out?');
        
        if (confirmSignOut) {
            // Add loading state
            this.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 12l2 2 4-4"></path>
                </svg>
                Signing out...
            `;
            
            // Simulate sign out process
            setTimeout(() => {
                alert('You have been signed out successfully!');
                // Reset button text
                this.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16,17 21,12 16,7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Sign Out
                `;
                // Here you would typically redirect to login page
                // window.location.href = '/login';
            }, 2000);
        }
        
        // Reset button scale
        setTimeout(() => {
            this.style.transform = '';
        }, 150);
    });
    
    // Add keyboard navigation support
    document.addEventListener('keydown', function(e) {
        const currentActive = document.querySelector('.nav-item.active');
        const navItemsArray = Array.from(navItems);
        const currentIndex = navItemsArray.indexOf(currentActive);
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % navItemsArray.length;
            navItemsArray[nextIndex].click();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = currentIndex === 0 ? navItemsArray.length - 1 : currentIndex - 1;
            navItemsArray[prevIndex].click();
        } else if (e.key === 'Enter') {
            if (document.activeElement === signOutBtn) {
                signOutBtn.click();
            }
        }
    });
    
    // Add smooth scroll effect for better UX
    navItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * 100);
    });
    
    // Initialize tooltips (optional feature)
    navItems.forEach(item => {
        const tooltip = item.querySelector('span').textContent;
        item.setAttribute('title', tooltip);
    });
    
    // Add window resize handler for responsive behavior
    window.addEventListener('resize', function() {
        const sidebar = document.querySelector('.sidebar');
        if (window.innerWidth <= 768) {
            sidebar.style.transform = 'translateX(-100%)';
            // Add mobile menu toggle logic here if needed
        } else {
            sidebar.style.transform = 'translateX(0)';
        }
    });
    
    console.log('Dashboard sidebar initialized successfully!');
});


// Dashboard Content JavaScript - To be integrated with your existing JS
// Sample data
const sampleData = {
    upcomingReservations: [
        { id: 1, customer: "John Doe", seat: "A12", time: "2:30 PM", date: "Today" },
        { id: 2, customer: "Jane Smith", seat: "B05", time: "3:45 PM", date: "Today" },
        { id: 3, customer: "Mike Johnson", seat: "C08", time: "5:15 PM", date: "Today" },
        { id: 4, customer: "Sarah Wilson", seat: "D03", time: "10:00 AM", date: "Tomorrow" },
        { id: 5, customer: "David Brown", seat: "A15", time: "1:20 PM", date: "Tomorrow" }
    ],
    recentActivity: [
        { type: "new", action: "New reservation created", details: "John Doe - Seat A12", time: "5 min ago" },
        { type: "cancelled", action: "Reservation cancelled", details: "Lisa Chen - Seat B07", time: "12 min ago" },
        { type: "completed", action: "Reservation completed", details: "Tom Wilson - Seat C15", time: "25 min ago" },
        { type: "new", action: "New user registered", details: "Alex Rodriguez", time: "1 hour ago" },
        { type: "completed", action: "Payment processed", details: "₱850 - Invoice #1234", time: "2 hours ago" }
    ],
    notifications: [
        { type: "warning", title: "Payment Failed", message: "Invoice #1235 payment failed for John Doe", time: "10 min ago" },
        { type: "error", title: "Double Booking Alert", message: "Seat A08 has conflicting reservations", time: "1 hour ago" },
        { type: "success", title: "System Backup", message: "Daily backup completed successfully", time: "2 hours ago" }
    ]
};
// Initialize dashboard when DOM is loaded
function initializeDashboard() {
    updateCurrentDate();
    loadUpcomingReservations();
    loadRecentActivity();
    loadNotifications();
    generateSeatMap();
    generateRevenueChart();
    bindEventListeners();
    
    // Update data periodically
    setInterval(updateDashboardData, 30000); // Update every 30 seconds
}

// Update current date display
function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        dateElement.textContent = now.toLocaleDateString('en-US', options);
    }
}

// Load upcoming reservations
function loadUpcomingReservations() {
    const container = document.getElementById('upcomingReservations');
    if (!container) return;
    
    container.innerHTML = '';
    
    sampleData.upcomingReservations.forEach(reservation => {
        const item = document.createElement('div');
        item.className = 'reservation-item';
        item.innerHTML = `
            <div class="reservation-info">
                <h4>${reservation.customer}</h4>
                <p>Seat ${reservation.seat} • ${reservation.date}</p>
            </div>
            <div class="reservation-time">${reservation.time}</div>
        `;
        container.appendChild(item);
    });
}

// Load recent activity
function loadRecentActivity() {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    container.innerHTML = '';
    
    sampleData.recentActivity.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-icon ${activity.type}">
                ${activity.type === 'new' ? 'N' : activity.type === 'cancelled' ? 'C' : 'D'}
            </div>
            <div class="activity-details">
                <h5>${activity.action}</h5>
                <p>${activity.details} • ${activity.time}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

// Load notifications
function loadNotifications() {
    const container = document.getElementById('notificationList');
    const countElement = document.getElementById('notificationCount');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (countElement) {
        countElement.textContent = sampleData.notifications.length;
    }
    
    sampleData.notifications.forEach(notification => {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.type}`;
        item.innerHTML = `
            <h5>${notification.title}</h5>
            <p>${notification.message}</p>
            <small style="color: #9CA3AF; font-size: 0.7rem;">${notification.time}</small>
        `;
        container.appendChild(item);
    });
}

// Generate seat map
function generateSeatMap() {
    const container = document.getElementById('seatMap');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Generate 72 seats (6 rows x 12 seats)
    for (let i = 1; i <= 72; i++) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.textContent = i;
        
        // Randomly assign seat status for demo
        const rand = Math.random();
        if (rand < 0.6) {
            seat.classList.add('available');
        } else if (rand < 0.85) {
            seat.classList.add('reserved');
        } else {
            seat.classList.add('blocked');
        }
        
        // Add click handler
        seat.addEventListener('click', () => {
            alert(`Seat ${i} - Status: ${seat.classList.contains('available') ? 'Available' : seat.classList.contains('reserved') ? 'Reserved' : 'Blocked'}`);
        });
        
        container.appendChild(seat);
    }
}

// Generate revenue chart
function generateRevenueChart() {
    const container = document.getElementById('revenueChart');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sample revenue data for last 7 days
    const revenueData = [8500, 12200, 9800, 15600, 11200, 13800, 12450];
    const maxRevenue = Math.max(...revenueData);
    
    const chartBars = document.createElement('div');
    chartBars.className = 'chart-bars';
    
    revenueData.forEach((revenue, index) => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        const height = (revenue / maxRevenue) * 150;
        bar.style.height = `${height}px`;
        bar.title = `Day ${index + 1}: ₱${revenue.toLocaleString()}`;
        chartBars.appendChild(bar);
    });
    
    container.appendChild(chartBars);
}

// Update dashboard data
function updateDashboardData() {
    loadUpcomingReservations();
    loadRecentActivity();
    loadNotifications();
    generateSeatMap();
    generateRevenueChart();
    updateCurrentDate();
}

// Bind event listeners
function bindEventListeners() {
    // Time filter change
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', (e) => {
            console.log('Filter changed to:', e.target.value);
            // Implement filter logic here
            loadUpcomingReservations(); // Reload with filter
        });
    }
    
    // Refresh activity button
    const refreshBtn = document.getElementById('refreshActivity');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Add transition for smooth animation
            refreshBtn.style.transition = 'transform 0.5s ease-in-out';
            refreshBtn.style.transform = 'rotate(360deg)';
            
            // Reset transform and refresh data
            setTimeout(() => {
                refreshBtn.style.transform = 'rotate(0deg)';
                loadRecentActivity(); // Refresh the activity data
            }, 500);
        });    
    }
    
    // Notification toggle
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    if (notificationBtn && notificationPanel) {
        notificationBtn.addEventListener('click', () => {
            notificationPanel.style.display = 
                notificationPanel.style.display === 'block' ? 'none' : 'block';
        });
    }
    
    // Close notification panel when clicking outside
    document.addEventListener('click', (e) => {
        const notificationPanel = document.getElementById('notificationPanel');
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationPanel && notificationBtn && 
            !notificationPanel.contains(e.target) && 
            !notificationBtn.contains(e.target)) {
            notificationPanel.style.display = 'none';
        }
    });
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);