document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // Redirect if already logged in
    auth.onAuthStateChanged(user => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    // On successful login, check user role from Firestore
                    return db.collection('Accounts').where('email', '==', userCredential.user.email).limit(1).get();
                })
                .then(snapshot => {
                    if (snapshot.empty) {
                        loginError.textContent = 'User role not found in database.';
                        auth.signOut();
                        return;
                    }
                    const userData = snapshot.docs[0].data();
                    localStorage.setItem('userRole', userData.type); // Store role in local storage
                    window.location.href = 'dashboard.html';
                })
                .catch(error => {
                    loginError.textContent = error.message;
                });
        });
    }
});