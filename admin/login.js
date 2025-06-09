
function goToDashboard() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (username === '' || password === '') {
        alert('Please fill in both fields.');
        return;
    }

    // Example: replace with real validation
    if (username === 'admin' && password === 'admin123') {
        window.location.href = 'dashboard.html'; // replace with your dashboard page
    } else {
        alert('Invalid username or password.');
    }
}

function clearForm() {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('.toggle-password');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.src = 'hide.png'; // When showing password
    } else {
        passwordInput.type = 'password';
        toggleIcon.src = 'eye.png'; // When hiding password
    }
}
