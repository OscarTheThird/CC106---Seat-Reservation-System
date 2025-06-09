function login() {
    // You can implement login functionality here
    alert("Login button clicked");

     window.location.href = 'login.html';
  }
  
  // Add event listeners to buttons
  document.querySelector('.book-btn').addEventListener('click', function() {
    alert("BOOK button clicked");
  });
  
  document.querySelector('.now-btn').addEventListener('click', function() {
    alert("NOW button clicked");
  });
  
  document.querySelector('.register-link').addEventListener('click', function(e) {
    e.preventDefault();
    alert("Register link clicked");
  });
 
