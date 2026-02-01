// Firebase Configuration (replace with your own)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Auth Buttons
document.getElementById('email-login').onclick = () => {
    const email = prompt("Enter email:");
    const pass = prompt("Enter password:");
    auth.signInWithEmailAndPassword(email, pass)
        .then(user => alert("Signed in as " + user.user.email))
        .catch(err => alert(err.message));
};

document.getElementById('google-login').onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => alert("Signed in as " + result.user.email))
        .catch(err => alert(err.message));
};

// Chat Handling
document.getElementById('send-btn').onclick = async () => {
    const input = document.getElementById('user-input').value;
    const model = document.getElementById('ai-model').value;
    if (!input) return;

    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `<div class="user-msg">You: ${input}</div>`;
    document.getElementById('user-input').value = '';

    // Placeholder AI response
    let response = await fakeAIResponse(input, model);
    chatBox.innerHTML += `<div class="ai-msg">${model}: ${response}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
};

// Fake AI function (replace with actual API call)
function fakeAIResponse(msg, model) {
    return new Promise(res => {
        setTimeout(() => {
            res(`This is a response from ${model} for your message: "${msg}"`);
        }, 1000);
    });
}

// File Attachment
document.getElementById('attach-btn').onclick = () => {
    document.getElementById('file-input').click();
};

document.getElementById('file-input').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    alert(`File "${file.name}" attached (hook this to Firebase storage later)`);
};

// Image Generation (Placeholder)
document.getElementById('generate-image').onclick = () => {
    const prompt = document.getElementById('image-prompt').value;
    if (!prompt) return;
    const imgContainer = document.getElementById('image-output');
    imgContainer.innerHTML = `<img src="https://via.placeholder.com/400x200?text=${encodeURIComponent(prompt)}" alt="Generated Image">`;
};