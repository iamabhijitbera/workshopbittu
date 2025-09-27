const firebaseConfig = {
  apiKey: "AIzaSyCDFvNTP4oW1YXJ9Ix6FI_9R_cMm3ATLzA",
  authDomain: "my-workshop-inventory.firebaseapp.com",
  projectId: "my-workshop-inventory",
  storageBucket: "my-workshop-inventory.firebasestorage.app",
  messagingSenderId: "19481561991",
  appId: "1:19481561991:web:d3fdb35a1e8ac257d8a122",
  measurementId: "G-JREVBRSPP2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();