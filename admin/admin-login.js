import FirebaseService from '../firebase-config.js';

class AdminLogin {
    constructor() {
        this.firebaseService = new FirebaseService();
        this.isProcessing = false;
        this.authCheckInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        
        // Don't auto-check auth status on login page - let user stay here
        // this.checkAuthStatus(); // Commented out to prevent auto-redirect
        
        this.setupAuthListener();
        this.prefillDemoCredentials(); // Auto-fill demo credentials for convenience
        this.setupSecurityChecks();
    }

    setupSecurityChecks() {
        // Clear any stored auth tokens/sessions when on login page
        this.clearPreviousSession();
        
        // Disable periodic auth checking on login page to prevent auto-redirect
        // Users should manually log in
        
        // Handle browser back/forward navigation
        window.addEventListener('popstate', () => {
            this.handleNavigationAttempt();
        });
        
        // Handle page visibility changes (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Don't auto-check auth when returning to login page
                console.log('👁️ User returned to login page');
            }
        });
    }

    checkAuthStatusGently() {
        // More intelligent auth checking that respects user logout
        const isAuthenticated = this.firebaseService.isAuthenticated();
        const hasValidSession = this.hasValidAuthSession();
        const wasRecentlyLoggedOut = this.wasRecentlyLoggedOut();
        
        // Don't auto-redirect if user was recently logged out
        if (wasRecentlyLoggedOut) {
            console.log('🚫 User recently logged out, not auto-redirecting');
            return;
        }
        
        // Only redirect if both auth checks pass AND user hasn't recently logged out
        if (isAuthenticated && hasValidSession) {
            console.log('👤 User already authenticated with valid session, redirecting...');
            this.redirectToDashboard();
        } else if (isAuthenticated && !hasValidSession) {
            console.log('⚠️ User authenticated but session invalid, clearing...');
            this.firebaseService.signOut();
            this.clearAuthSession();
        } else {
            console.log('❌ No valid authentication found');
            this.clearAuthSession();
        }
    }

    wasRecentlyLoggedOut() {
        try {
            const logoutTimestamp = localStorage.getItem('adminLogoutTimestamp');
            if (!logoutTimestamp) {
                return false;
            }
            
            const timestamp = parseInt(logoutTimestamp);
            const now = Date.now();
            const timeSinceLogout = now - timestamp;
            
            // Consider "recent logout" as within 30 seconds
            const recentLogoutWindow = 30 * 1000; // 30 seconds
            
            if (timeSinceLogout < recentLogoutWindow) {
                console.log(`🕐 Recent logout detected (${Math.round(timeSinceLogout / 1000)}s ago)`);
                return true;
            }
            
            // Clean up old logout timestamp
            localStorage.removeItem('adminLogoutTimestamp');
            return false;
        } catch (error) {
            console.log('❌ Error checking recent logout:', error);
            return false;
        }
    }

    clearPreviousSession() {
        // Clear any existing authentication state
        try {
            localStorage.removeItem('adminAuthToken');
            sessionStorage.removeItem('adminAuthToken');
            localStorage.removeItem('adminLoginTimestamp');
            sessionStorage.removeItem('adminLoginTimestamp');
            localStorage.removeItem('adminLogoutTimestamp'); // Clear logout timestamp too
            
            // Clear any Firebase auth persistence when on login page
            if (this.firebaseService && this.firebaseService.auth) {
                this.firebaseService.signOut().catch(() => {
                    // Ignore errors during cleanup
                });
            }
            
            console.log('🧹 All auth data cleared from login page');
        } catch (error) {
            console.log('Session cleanup completed');
        }
    }

    handleNavigationAttempt() {
        // If user tries to navigate back to dashboard without being logged in
        if (!this.firebaseService.isAuthenticated()) {
            // Force redirect to login page
            window.location.replace('admin-login.html');
        }
    }

    prefillDemoCredentials() {
        // Auto-fill demo credentials for easier testing
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        if (emailInput && passwordInput) {
            emailInput.value = 'admin@seatreservation.com';
            passwordInput.value = 'admin123456';
        }
    }

    setupAuthListener() {
        // Only redirect on successful login, not on existing auth state
        this.firebaseService.onAuthStateChanged = (user) => {
            // Only redirect if this is a fresh login (not existing auth state)
            if (user && this.isProcessing) {
                console.log('✅ Fresh login detected, redirecting to dashboard...');
                this.setAuthSession(user);
                this.redirectToDashboard();
            } else if (user && !this.isProcessing) {
                console.log('👤 Existing auth state detected, but staying on login page');
                // Don't redirect - let user manually decide
            } else if (!user) {
                console.log('❌ No authenticated user');
                this.clearAuthSession();
            }
        };
    }

    setAuthSession(user) {
        // Set secure session markers
        const authData = {
            timestamp: Date.now(),
            sessionId: this.generateSessionId(),
            userLoggedIn: true
        };
        
        try {
            localStorage.setItem('adminAuthToken', JSON.stringify(authData));
            localStorage.setItem('adminLoginTimestamp', Date.now().toString());
            console.log('✅ Auth session set successfully');
        } catch (error) {
            console.warn('Could not set auth session:', error);
        }
    }

    clearAuthSession() {
        try {
            localStorage.removeItem('adminAuthToken');
            sessionStorage.removeItem('adminAuthToken');
            localStorage.removeItem('adminLoginTimestamp');
            sessionStorage.removeItem('adminLoginTimestamp');
        } catch (error) {
            console.warn('Could not clear auth session:', error);
        }
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    bindEvents() {
        // Form submission
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.isProcessing) {
                this.handleLogin();
            }
        });

        // Password toggle
        const togglePassword = document.getElementById('togglePassword');
        togglePassword.addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        // Enter key on inputs
        const inputs = document.querySelectorAll('#email, #password');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !this.isProcessing) {
                    this.handleLogin();
                }
            });
        });

        // Demo credentials quick fill
        const demoCredentialsElement = document.querySelector('.demo-credentials');
        if (demoCredentialsElement) {
            demoCredentialsElement.addEventListener('click', () => {
                this.prefillDemoCredentials();
            });
        }

        // Prevent form resubmission on page reload
        window.addEventListener('beforeunload', () => {
            this.isProcessing = false;
        });
    }

    checkAuthStatus() {
        // Initial auth check when page loads
        const isAuthenticated = this.firebaseService.isAuthenticated();
        const hasValidSession = this.hasValidAuthSession();
        const wasRecentlyLoggedOut = this.wasRecentlyLoggedOut();
        
        // Only redirect on initial load if user has valid auth AND hasn't recently logged out
        if (isAuthenticated && hasValidSession && !wasRecentlyLoggedOut) {
            console.log('👤 User already authenticated with valid session');
            this.redirectToDashboard();
        } else if (isAuthenticated && !hasValidSession) {
            console.log('⚠️ User authenticated but session invalid, clearing...');
            this.firebaseService.signOut();
            this.clearAuthSession();
        } else {
            console.log('❌ No valid authentication found or user recently logged out');
            this.clearAuthSession();
        }
    }

    hasValidAuthSession() {
        try {
            const authToken = localStorage.getItem('adminAuthToken');
            const loginTimestamp = localStorage.getItem('adminLoginTimestamp');
            
            if (!authToken || !loginTimestamp) {
                return false;
            }
            
            const authData = JSON.parse(authToken);
            const timestamp = parseInt(loginTimestamp);
            const now = Date.now();
            
            // Check if session is less than 24 hours old
            const sessionValidityPeriod = 24 * 60 * 60 * 1000; // 24 hours
            
            if (now - timestamp > sessionValidityPeriod) {
                console.log('⏰ Auth session expired');
                return false;
            }
            
            // Verify auth data integrity - simplified check
            if (!authData.timestamp || !authData.sessionId) {
                console.log('🔍 Invalid auth data structure');
                return false;
            }
            
            return true;
        } catch (error) {
            console.log('❌ Error validating auth session:', error);
            return false;
        }
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.querySelector('#togglePassword i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            toggleIcon.className = 'fas fa-eye';
        }
    }

    async handleLogin() {
        if (this.isProcessing) return;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        const loginBtn = document.querySelector('.login-btn');

        // Validation
        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        this.isProcessing = true;

        try {
            // Show loading state
            this.showLoadingModal(true);
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Authenticating...';
            loginBtn.disabled = true;

            console.log('🔐 Attempting login for:', email);

            // Clear any previous session before login
            this.clearAuthSession();

            // Attempt Firebase authentication
            const result = await this.firebaseService.loginAdmin(email, password);

            if (result.success) {
                console.log('✅ Login successful');
                
                // Set new secure session
                this.setAuthSession(result.user || { uid: 'admin', email });
                
                // If it's a new user (demo admin just created), initialize sample data
                if (result.isNewUser) {
                    console.log('🎯 New demo admin created, initializing sample data...');
                    await this.initializeSampleData();
                }
                
                this.loginSuccess();
            } else {
                console.log('❌ Login failed:', result.error);
                this.loginFailed(result.error);
            }
        } catch (error) {
            console.error('💥 Login error:', error);
            this.loginFailed('An unexpected error occurred. Please try again.');
        } finally {
            this.isProcessing = false;
            this.showLoadingModal(false);
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
            loginBtn.disabled = false;
        }
    }

    async initializeSampleData() {
        try {
            console.log('📚 Initializing sample data...');
            const result = await this.firebaseService.initializeSampleData();
            if (result.success) {
                console.log('✅ Sample data initialized:', result.message);
                this.showToast('Demo data created successfully!', 'success');
            } else {
                console.log('⚠️ Sample data initialization failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Error initializing sample data:', error);
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    loginSuccess() {
        // Show success animation
        const loginBtn = document.querySelector('.login-btn');
        loginBtn.innerHTML = '<i class="fas fa-check me-2"></i>Success!';
        loginBtn.classList.remove('btn-primary');
        loginBtn.classList.add('btn-success');

        // Show success toast
        this.showToast('Login successful! Redirecting to dashboard...', 'success');

        // Clear the auth check interval since we're redirecting
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }

        // Mark as fresh login and redirect after short delay
        setTimeout(() => {
            this.redirectToDashboard();
        }, 1500);
    }

    loginFailed(errorMessage) {
        // Parse Firebase error messages to user-friendly messages
        const userFriendlyMessage = this.parseFirebaseError(errorMessage);
        this.showError(userFriendlyMessage);
        this.shakeCard();
        
        // Clear any partial session data
        this.clearAuthSession();
    }

    parseFirebaseError(errorMessage) {
        console.log('🔍 Parsing Firebase error:', errorMessage);
        
        if (errorMessage.includes('user-not-found') || errorMessage.includes('auth/user-not-found')) {
            return 'Demo admin account not found. Creating account... Please try again.';
        } else if (errorMessage.includes('wrong-password') || errorMessage.includes('auth/wrong-password')) {
            return 'Incorrect password. Please check the demo credentials and try again.';
        } else if (errorMessage.includes('invalid-email') || errorMessage.includes('auth/invalid-email')) {
            return 'Please enter a valid email address.';
        } else if (errorMessage.includes('invalid-credential') || errorMessage.includes('auth/invalid-credential')) {
            return 'Invalid credentials. If this is your first time, the demo account may need to be created.';
        } else if (errorMessage.includes('email-already-in-use') || errorMessage.includes('auth/email-already-in-use')) {
            return 'Demo account exists. Please use the correct password.';
        } else if (errorMessage.includes('too-many-requests') || errorMessage.includes('auth/too-many-requests')) {
            return 'Too many failed attempts. Please wait a moment and try again.';
        } else if (errorMessage.includes('network-request-failed')) {
            return 'Network error. Please check your internet connection.';
        } else if (errorMessage.includes('Demo admin exists but login failed')) {
            return 'Demo account exists but login failed. Please verify your credentials.';
        } else {
            return 'Login failed. Please check your credentials. If this is your first time, try again to create the demo account.';
        }
    }

    showError(message) {
        const errorMessageElement = document.getElementById('errorMessage');
        errorMessageElement.innerHTML = `
            <div class="mb-2">${message}</div>
            ${this.isDemoCredentialsError(message) ? this.getDemoCredentialsHelp() : ''}
        `;
        
        const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        errorModal.show();
    }

    isDemoCredentialsError(message) {
        return message.includes('credentials') || message.includes('password') || message.includes('invalid');
    }

    getDemoCredentialsHelp() {
        return `
            <div class="alert alert-info p-2 mt-2">
                <small>
                    <strong>Demo Credentials:</strong><br>
                    Email: admin@seatreservation.com<br>
                    Password: admin123456
                </small>
            </div>
        `;
    }

    showLoadingModal(show) {
        const loadingModal = document.getElementById('loadingModal');
        if (show) {
            new bootstrap.Modal(loadingModal).show();
        } else {
            const modalInstance = bootstrap.Modal.getInstance(loadingModal);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
    }

    shakeCard() {
        const loginCard = document.querySelector('.login-card');
        loginCard.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            loginCard.style.animation = '';
        }, 500);
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        // Add to page
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove after hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    redirectToDashboard() {
        console.log('🔄 Redirecting to admin dashboard...');
        
        // Clear the auth check interval
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
        
        // Use replace instead of href to prevent back navigation
        window.location.replace('admin-dashboard.html');
    }

    // Cleanup method
    destroy() {
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
    }

    // Quick demo login method (for testing)
    async quickDemoLogin() {
        document.getElementById('email').value = 'admin@seatreservation.com';
        document.getElementById('password').value = 'admin123456';
        await this.handleLogin();
    }
}

// Initialize login system
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Admin Login System...');
    const adminLogin = new AdminLogin();
    
    // Make it globally available for debugging
    window.adminLogin = adminLogin;
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.adminLogin) {
            window.adminLogin.destroy();
        }
    });
});

// Add shake animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    .login-card {
        transition: all 0.3s ease;
    }
    
    .demo-credentials {
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .demo-credentials:hover {
        background: rgba(0,0,0,0.05);
        border-radius: 5px;
    }
    
    .form-control:focus {
        border-color: #007bff;
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
    }
    
    .login-btn {
        transition: all 0.3s ease;
    }
    
    .login-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
`;
document.head.appendChild(style);