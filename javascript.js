// ==================== FIREBASE CONFIGURATION ====================
const firebaseConfig = {
     apiKey: "AIzaSyAtUrEx-xIDqYZsIzWU-mG8_Fbc3s6D3Ic",
  authDomain: "nixai-d93cb.firebaseapp.com",
  projectId: "nixai-d93cb",
  storageBucket: "nixai-d93cb.firebasestorage.app",
  messagingSenderId: "120045328987",
  appId: "1:120045328987:web:01ab5651163b5c6c483d7e",
  measurementId: "G-4J7K0ZFMNT"

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ==================== APP STATE ====================
let currentUser = null;
let currentChatId = null;
let isVerifyingOTP = false;
let tempEmail = null;
let selectedModel = 'cyanix-pro';
let conversationHistory = [];
let attachedFiles = [];
let currentPreviewFile = null;

// Supported file types
const SUPPORTED_FILE_TYPES = {
    'image/jpeg': { icon: 'fas fa-image', color: '#FF6B6B' },
    'image/jpg': { icon: 'fas fa-image', color: '#FF6B6B' },
    'image/png': { icon: 'fas fa-image', color: '#4ECDC4' },
    'image/gif': { icon: 'fas fa-photo-video', color: '#45B7D1' },
    'application/pdf': { icon: 'fas fa-file-pdf', color: '#FF4757' },
    'text/plain': { icon: 'fas fa-file-alt', color: '#2ED573' },
    'text/html': { icon: 'fas fa-code', color: '#3742FA' },
    'application/msword': { icon: 'fas fa-file-word', color: '#1B98F5' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'fas fa-file-word', color: '#1B98F5' },
    'default': { icon: 'fas fa-file', color: '#747D8C' }
};

// ==================== CYANIX API CONFIGURATION ====================
const CYANIX_API_CONFIG = {
    BASE_URL: 'https://api.cyanix.ai/v1', // Replace with actual Cyanix API endpoint
    ENDPOINTS: {
        CHAT: '/chat/completions',
        VISION: '/vision/analyze',
        MODELS: '/models'
    },
    DEFAULT_MODEL: 'cyanix-pro'
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupFileHandlers();
});

function initApp() {
    // Animate loading progress
    const loadingProgress = document.getElementById('loadingProgress');
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
        }
        loadingProgress.style.width = progress + '%';
    }, 200);

    // Hide splash screen after delay
    setTimeout(() => {
        document.getElementById('splashScreen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('splashScreen').style.display = 'none';
            
            // Check Firebase auth state
            auth.onAuthStateChanged((user) => {
                if (user) {
                    if (isVerifyingOTP) {
                        // Do nothing, waiting for OTP verification
                    } else {
                        handleUserSignedIn(user);
                    }
                } else {
                    handleUserSignedOut();
                }
            });
            
        }, 500);
    }, 3000);
}

function setupFileHandlers() {
    // File input change handler
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop handlers
    const fileDropZone = document.getElementById('fileDropZone');
    
    fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropZone.classList.add('drag-over');
    });
    
    fileDropZone.addEventListener('dragleave', () => {
        fileDropZone.classList.remove('drag-over');
    });
    
    fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        handleFiles(files);
    });
    
    // Click to trigger file input
    fileDropZone.addEventListener('click', () => {
        fileInput.click();
    });
}

function handleUserSignedIn(user) {
    currentUser = {
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        avatar: getAvatarInitials(user.displayName || user.email),
        photoURL: user.photoURL,
        emailVerified: user.emailVerified
    };
    
    showChatInterface();
    loadUserSettings();
    showToast('Welcome to Cyanix AI!', 'success');
}

function handleUserSignedOut() {
    currentUser = null;
    attachedFiles = [];
    updateAttachedFilesPreview();
    showAuth();
}

// ==================== FILE ATTACHMENT FUNCTIONS ====================
function openFileAttachmentModal() {
    document.getElementById('fileAttachmentModal').classList.add('active');
}

function closeFileAttachmentModal() {
    document.getElementById('fileAttachmentModal').classList.remove('active');
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!isFileTypeSupported(file)) {
            showToast(`File type not supported: ${file.name}`, 'warning');
            continue;
        }
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showToast(`File too large (max 10MB): ${file.name}`, 'warning');
            continue;
        }
        
        // Check if file already attached
        if (attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
            showToast(`File already attached: ${file.name}`, 'info');
            continue;
        }
        
        // Add to attached files
        attachedFiles.push(file);
    }
    
    updateAttachedFilesPreview();
    updateSelectedFilesList();
}

function isFileTypeSupported(file) {
    const supportedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'application/pdf', 'text/plain', 'text/html',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    return supportedTypes.includes(file.type);
}

function updateAttachedFilesPreview() {
    const container = document.getElementById('attachedFilesPreview');
    
    if (attachedFiles.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    container.innerHTML = '';
    
    attachedFiles.forEach((file, index) => {
        const fileInfo = getFileInfo(file);
        const fileElement = document.createElement('div');
        fileElement.className = 'attached-file-item';
        fileElement.innerHTML = `
            <i class="${fileInfo.icon}" style="color: ${fileInfo.color};"></i>
            <span>${file.name}</span>
            <button class="remove-file" onclick="removeAttachedFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(fileElement);
    });
}

function updateSelectedFilesList() {
    const container = document.getElementById('selectedFilesList');
    container.innerHTML = '';
    
    if (attachedFiles.length === 0) {
        container.innerHTML = '<p style="color: var(--cyan-light); opacity: 0.7; text-align: center; padding: 20px;">No files selected</p>';
        return;
    }
    
    attachedFiles.forEach((file, index) => {
        const fileInfo = getFileInfo(file);
        const fileSize = formatFileSize(file.size);
        
        const fileElement = document.createElement('div');
        fileElement.className = 'selected-file-item';
        fileElement.innerHTML = `
            <div class="selected-file-info">
                <i class="${fileInfo.icon} selected-file-icon" style="color: ${fileInfo.color};"></i>
                <div class="selected-file-details">
                    <div class="selected-file-name">${file.name}</div>
                    <div class="selected-file-size">${fileSize}</div>
                </div>
            </div>
            <button class="selected-file-remove" onclick="removeAttachedFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(fileElement);
    });
}

function removeAttachedFile(index) {
    attachedFiles.splice(index, 1);
    updateAttachedFilesPreview();
    updateSelectedFilesList();
}

function getFileInfo(file) {
    return SUPPORTED_FILE_TYPES[file.type] || SUPPORTED_FILE_TYPES['default'];
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadSelectedFiles() {
    if (attachedFiles.length === 0) {
        showToast('No files selected', 'warning');
        return;
    }

    // Create conversation if doesn't exist
    if (!currentChatId) {
        const conversationRef = await db.collection('conversations').add({
            userId: currentUser.uid,
            title: 'Files Upload',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentChatId = conversationRef.id;
        document.getElementById('chatTitle').textContent = 'Files Upload';
    }

    // Upload each file
    const uploadPromises = attachedFiles.map(async (file) => {
        try {
            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const fileName = `${timestamp}_${randomString}_${file.name}`;
            
            // Create storage reference
            const storageRef = storage.ref();
            const fileRef = storageRef.child(`conversations/${currentChatId}/${fileName}`);
            
            // Upload file
            const uploadTask = fileRef.put(file);
            
            // Create upload progress UI
            const fileIndex = attachedFiles.indexOf(file);
            createUploadProgress(fileIndex, file);
            
            // Wait for upload to complete
            const snapshot = await uploadTask;
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Save file info to Firestore
            const fileData = {
                conversationId: currentChatId,
                userId: currentUser.uid,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                downloadURL: downloadURL,
                storagePath: snapshot.ref.fullPath,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('files').add(fileData);
            
            // Update UI
            updateUploadProgress(fileIndex, 100, true);
            
            return fileData;
            
        } catch (error) {
            console.error('Error uploading file:', error);
            showToast(`Error uploading ${file.name}: ${error.message}`, 'error');
            updateUploadProgress(attachedFiles.indexOf(file), 0, false);
            throw error;
        }
    });

    try {
        showToast('Uploading files...', 'info');
        const uploadedFiles = await Promise.all(uploadPromises);
        
        // Clear attached files
        attachedFiles = [];
        updateAttachedFilesPreview();
        updateSelectedFilesList();
        
        showToast('Files uploaded successfully!', 'success');
        closeFileAttachmentModal();
        
        // Add message with file attachments
        const messageContent = `I've uploaded ${uploadedFiles.length} file(s).`;
        addMessageToUI(messageContent, 'user', uploadedFiles);
        
    } catch (error) {
        showToast('Some files failed to upload', 'error');
    }
}

function createUploadProgress(fileIndex, file) {
    const container = document.getElementById('selectedFilesList');
    const fileItems = container.querySelectorAll('.selected-file-item');
    
    if (fileItems[fileIndex]) {
        const progressBar = document.createElement('div');
        progressBar.className = 'file-upload-progress';
        progressBar.innerHTML = '<div class="file-upload-progress-bar" style="width: 0%"></div>';
        fileItems[fileIndex].appendChild(progressBar);
    }
}

function updateUploadProgress(fileIndex, progress, success) {
    const container = document.getElementById('selectedFilesList');
    const fileItems = container.querySelectorAll('.selected-file-item');
    
    if (fileItems[fileIndex]) {
        const progressBar = fileItems[fileIndex].querySelector('.file-upload-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.style.background = success ? 
                'linear-gradient(90deg, var(--green-neon), var(--cyan-primary))' :
                'linear-gradient(90deg, var(--cyan-secondary), var(--cyan-primary))';
        }
    }
}

// ==================== FILE PREVIEW FUNCTIONS ====================
function openFilePreviewModal(fileData) {
    currentPreviewFile = fileData;
    const modal = document.getElementById('filePreviewModal');
    const content = document.getElementById('filePreviewContent');
    const downloadBtn = document.getElementById('downloadPreviewBtn');
    
    modal.classList.add('active');
    content.innerHTML = '';
    
    // Show loading
    content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="typing-indicator" style="justify-content: center;">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <p style="color: var(--cyan-light); margin-top: 20px;">Loading file preview...</p>
        </div>
    `;
    
    // Set download button
    downloadBtn.onclick = () => downloadFile(fileData);
    
    // Load file content based on type
    if (fileData.fileType.startsWith('image/')) {
        loadImagePreview(fileData.downloadURL);
    } else if (fileData.fileType === 'application/pdf') {
        loadPDFPreview(fileData.downloadURL);
    } else if (fileData.fileType.startsWith('text/')) {
        loadTextPreview(fileData.downloadURL);
    } else {
        loadGenericPreview(fileData);
    }
}

function closeFilePreviewModal() {
    document.getElementById('filePreviewModal').classList.remove('active');
    currentPreviewFile = null;
}

function loadImagePreview(url) {
    const content = document.getElementById('filePreviewContent');
    content.innerHTML = `
        <img src="${url}" class="file-preview-image" alt="Preview">
        <div class="file-preview-info">
            <h4><i class="fas fa-info-circle"></i> File Information</h4>
            <p><strong>Type:</strong> Image</p>
            <p><strong>Size:</strong> ${formatFileSize(currentPreviewFile.fileSize)}</p>
            <p><strong>Name:</strong> ${currentPreviewFile.fileName}</p>
        </div>
    `;
}

function loadPDFPreview(url) {
    const content = document.getElementById('filePreviewContent');
    content.innerHTML = `
        <iframe src="${url}" style="width: 100%; height: 400px; border: none; border-radius: 10px;"></iframe>
        <div class="file-preview-info">
            <h4><i class="fas fa-info-circle"></i> File Information</h4>
            <p><strong>Type:</strong> PDF Document</p>
            <p><strong>Size:</strong> ${formatFileSize(currentPreviewFile.fileSize)}</p>
            <p><strong>Name:</strong> ${currentPreviewFile.fileName}</p>
            <p><em>Note: PDF preview may not work in all browsers. Click download to save the file.</em></p>
        </div>
    `;
}

async function loadTextPreview(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        const content = document.getElementById('filePreviewContent');
        content.innerHTML = `
            <div class="file-preview-text">${escapeHtml(text.substring(0, 10000))}${text.length > 10000 ? '\n\n... (truncated)' : ''}</div>
            <div class="file-preview-info">
                <h4><i class="fas fa-info-circle"></i> File Information</h4>
                <p><strong>Type:</strong> Text Document</p>
                <p><strong>Size:</strong> ${formatFileSize(currentPreviewFile.fileSize)}</p>
                <p><strong>Name:</strong> ${currentPreviewFile.fileName}</p>
                <p><strong>Characters:</strong> ${text.length}</p>
            </div>
        `;
    } catch (error) {
        showToast('Error loading text file', 'error');
        loadGenericPreview(currentPreviewFile);
    }
}

function loadGenericPreview(fileData) {
    const content = document.getElementById('filePreviewContent');
    content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <i class="fas fa-file" style="font-size: 80px; color: var(--cyan-primary); margin-bottom: 20px;"></i>
            <h4 style="color: var(--cyan-primary); margin-bottom: 10px;">${fileData.fileName}</h4>
            <p style="color: var(--cyan-light);">This file type cannot be previewed directly.</p>
        </div>
        <div class="file-preview-info">
            <h4><i class="fas fa-info-circle"></i> File Information</h4>
            <p><strong>Type:</strong> ${fileData.fileType}</p>
            <p><strong>Size:</strong> ${formatFileSize(fileData.fileSize)}</p>
            <p><strong>Name:</strong> ${fileData.fileName}</p>
            <p>Click download to save the file to your device.</p>
        </div>
    `;
}

function downloadPreviewFile() {
    if (currentPreviewFile) {
        downloadFile(currentPreviewFile);
    }
}

function downloadFile(fileData) {
    const a = document.createElement('a');
    a.href = fileData.downloadURL;
    a.download = fileData.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading ${fileData.fileName}...`, 'success');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== CYANIX API FUNCTIONS ====================
async function callCyanixAPI(message, files = []) {
    // This is a mock function - in production, this would call the actual Cyanix API
    // For now, we'll simulate API responses
    
    try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check for image analysis requests
        if (selectedModel === 'cyanix-vision' && files.length > 0 && files.some(f => f.fileType.startsWith('image/'))) {
            return simulateVisionAnalysis(files);
        }
        
        // Regular text response based on model
        return simulateTextResponse(message, selectedModel);
        
    } catch (error) {
        console.error('Cyanix API Error:', error);
        throw new Error(`Failed to get response from Cyanix AI: ${error.message}`);
    }
}

function simulateVisionAnalysis(files) {
    const imageFiles = files.filter(f => f.fileType.startsWith('image/'));
    let response = `I can see ${imageFiles.length} image(s).\n\n`;
    
    imageFiles.forEach((file, index) => {
        response += `Image ${index + 1} (${file.fileName}):\n`;
        
        // Simulate different types of image analysis
        const analyses = [
            "This appears to be a high-quality image with good composition.",
            "The image shows interesting visual elements that could be analyzed further.",
            "I can identify various features in this image that might be relevant to your query.",
            "This image contains visual data that could be useful for analysis or creative projects."
        ];
        
        const randomAnalysis = analyses[Math.floor(Math.random() * analyses.length)];
        response += `${randomAnalysis}\n\n`;
    });
    
    response += "If you have specific questions about these images, feel free to ask!";
    return response;
}

function simulateTextResponse(message, model) {
    // Simulate different model personalities
    const modelResponses = {
        'cyanix-pro': `I've analyzed your query "${message.substring(0, 50)}..." and here's my comprehensive response:\n\nAs a sophisticated AI model, I can provide detailed analysis, creative solutions, and expert insights on this topic. The key points to consider are...`,
        'cyanix-flash': `Here's a quick response to your query:\n\nBased on the information provided, I recommend considering the following approach. This should help you achieve your goals efficiently.`,
        'cyanix-advanced': `As an expert AI model, I can provide specialized analysis on this topic.\n\nFrom a technical perspective, the most important factors to consider are...`
    };
    
    const baseResponse = modelResponses[model] || modelResponses['cyanix-pro'];
    
    // Add some dynamic content based on message
    if (message.toLowerCase().includes('code') || message.toLowerCase().includes('program')) {
        return `${baseResponse}\n\nHere's a code example that might help:\n\`\`\`python\ndef solution():\n    # Your implementation here\n    return "Result"\n\`\`\``;
    } else if (message.toLowerCase().includes('business') || message.toLowerCase().includes('startup')) {
        return `${baseResponse}\n\nKey business considerations:\n1. Market analysis\n2. Competitive advantage\n3. Revenue model\n4. Scalability factors`;
    } else if (message.toLowerCase().includes('creative') || message.toLowerCase().includes('idea')) {
        return `${baseResponse}\n\nCreative suggestions:\n• Brainstorm multiple approaches\n• Consider unconventional solutions\n• Combine different concepts\n• Test and iterate`;
    }
    
    return `${baseResponse}\n\nIs there anything specific you'd like me to elaborate on?`;
}

function getModelDisplayName(model) {
    const modelNames = {
        'cyanix-pro': 'Cyanix Pro',
        'cyanix-flash': 'Cyanix Flash',
        'cyanix-vision': 'Cyanix Vision',
        'cyanix-advanced': 'Cyanix Advanced'
    };
    return modelNames[model] || 'Cyanix Pro';
}

function updateModelStatus() {
    const indicator = document.querySelector('.ai-model-indicator');
    const text = document.getElementById('modelStatusText');
    
    indicator.style.background = 'var(--green-neon)';
    indicator.style.boxShadow = '0 0 10px var(--green-neon)';
    indicator.style.animation = 'pulse 2s infinite';
    text.textContent = `${getModelDisplayName(selectedModel)} • Ready`;
}

// ==================== MODEL MANAGEMENT ====================
function openModelModal() {
    document.getElementById('modelModal').classList.add('active');
    highlightSelectedModel();
}

function closeModelModal() {
    document.getElementById('modelModal').classList.remove('active');
}

function selectModel(model) {
    const modelBtns = document.querySelectorAll('.model-btn');
    modelBtns.forEach(btn => {
        if (btn.dataset.model === model) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    selectedModel = model;
}

function highlightSelectedModel() {
    const modelBtns = document.querySelectorAll('.model-btn');
    modelBtns.forEach(btn => {
        if (btn.dataset.model === selectedModel) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

async function saveModelSelection() {
    if (currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).set({
                settings: {
                    aiModel: selectedModel,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });

            updateModelStatus();
            closeModelModal();
            showToast(`AI model changed to ${getModelDisplayName(selectedModel)}`, 'success');
        } catch (error) {
            console.error('Error saving model selection:', error);
            showToast('Error saving model selection', 'error');
        }
    } else {
        updateModelStatus();
        closeModelModal();
        showToast(`AI model changed to ${getModelDisplayName(selectedModel)}`, 'success');
    }
}

async function loadUserSettings() {
    if (!currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            if (data.settings && data.settings.aiModel) {
                selectedModel = data.settings.aiModel;
                updateModelStatus();
            }
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
    }
}

// ==================== AUTH FUNCTIONS ====================
function switchAuthTab(tab) {
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const otpForm = document.getElementById('otpForm');
    const authTabs = document.getElementById('authTabs');
    
    if (tab === 'signin') {
        authTabs.classList.remove('signup-active');
        signinForm.style.display = 'block';
        signupForm.style.display = 'none';
        otpForm.style.display = 'none';
    } else {
        authTabs.classList.add('signup-active');
        signinForm.style.display = 'none';
        signupForm.style.display = 'block';
        otpForm.style.display = 'none';
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.parentElement.querySelector('.password-toggle i');
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.classList.remove('fa-eye');
        toggle.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        toggle.classList.remove('fa-eye-slash');
        toggle.classList.add('fa-eye');
    }
}

async function signInWithEmail() {
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Set persistence based on remember me
    const persistence = rememberMe ? 
        firebase.auth.Auth.Persistence.LOCAL : 
        firebase.auth.Auth.Persistence.SESSION;
    
    try {
        await auth.setPersistence(persistence);
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpTime = new Date();

        // Store OTP in Firestore
        await db.collection('users').doc(user.uid).update({
            tempOtp: otp,
            tempOtpTime: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Store temp email for resend
        tempEmail = email;

        // Set verifying flag
        isVerifyingOTP = true;

        // Switch to OTP form
        document.getElementById('signinForm').style.display = 'none';
        document.getElementById('otpForm').style.display = 'block';

        showToast('Verification code sent to your email', 'success');
    } catch (error) {
        showToast(getFirebaseError(error), 'error');
    }
}

async function verifyOTP() {
    const code = document.getElementById('otpCode').value.trim();

    if (code.length !== 6) {
        showToast('Please enter a 6-digit code', 'error');
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) {
            showToast('Session expired. Please sign in again', 'error');
            switchAuthTab('signin');
            return;
        }

        const userDocSnap = await db.collection('users').doc(user.uid).get();
        const data = userDocSnap.data();

        if (!data || !data.tempOtp) {
            showToast('No verification code found. Please sign in again', 'error');
            auth.signOut();
            return;
        }

        const savedOtp = data.tempOtp;
        const otpTime = data.tempOtpTime.toDate();
        const now = new Date();

        if (now - otpTime > 5 * 60 * 1000) { // 5 minutes expiration
            showToast('Verification code expired. Please sign in again', 'error');
            auth.signOut();
            return;
        }

        if (savedOtp === code) {
            // Clear temp OTP
            await userDocSnap.ref.update({
                tempOtp: firebase.firestore.FieldValue.delete(),
                tempOtpTime: firebase.firestore.FieldValue.delete()
            });

            // Proceed to signed in state
            isVerifyingOTP = false;
            handleUserSignedIn(user);
            showToast('Verification successful!', 'success');
        } else {
            showToast('Invalid verification code', 'error');
        }
    } catch (error) {
        showToast('Error verifying code: ' + error.message, 'error');
    }
}

async function resendOTP() {
    try {
        const user = auth.currentUser;
        if (!user || !tempEmail) return;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpTime = new Date();

        await db.collection('users').doc(user.uid).update({
            tempOtp: otp,
            tempOtpTime: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('New code sent to your email', 'success');
    } catch (error) {
        showToast('Error resending code', 'error');
    }
}

async function signUpWithEmail() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const acceptTerms = document.getElementById('acceptTerms').checked;
    
    // Validation
    if (!name) {
        showToast('Please enter your name', 'error');
        return;
    }
    
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (password.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (!acceptTerms) {
        showToast('Please accept the terms and privacy policy', 'error');
        return;
    }
    
    try {
        // Create user with Firebase
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update profile with name
        await user.updateProfile({
            displayName: name
        });
        
        // Send email verification
        await user.sendEmailVerification();
        
        // Save user data to Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            avatar: getAvatarInitials(name),
            plan: 'free',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            settings: {
                emailNotifications: true,
                marketingEmails: false,
                saveHistory: true,
                aiModel: 'cyanix-pro',
                responseLength: 'medium'
            }
        });
        
        showToast('Account created! Please check your email for verification.', 'success');
    } catch (error) {
        showToast(getFirebaseError(error), 'error');
    }
}

async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Save user data to Firestore if new user
        await db.collection('users').doc(user.uid).set({
            name: user.displayName,
            email: user.email,
            avatar: getAvatarInitials(user.displayName),
            photoURL: user.photoURL,
            plan: 'free',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            provider: 'google',
            settings: {
                emailNotifications: true,
                marketingEmails: false,
                saveHistory: true,
                aiModel: 'cyanix-pro',
                responseLength: 'medium'
            }
        }, { merge: true });
        
        showToast('Signed in with Google!', 'success');
    } catch (error) {
        showToast(getFirebaseError(error), 'error');
    }
}

async function signInWithMicrosoft() {
    try {
        const provider = new firebase.auth.OAuthProvider('microsoft.com');
        provider.addScope('profile');
        provider.addScope('email');
        provider.setCustomParameters({
            tenant: 'common'
        });
        
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Save user data to Firestore if new user
        await db.collection('users').doc(user.uid).set({
            name: user.displayName,
            email: user.email,
            avatar: getAvatarInitials(user.displayName),
            photoURL: user.photoURL,
            plan: 'free',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            provider: 'microsoft',
            settings: {
                emailNotifications: true,
                marketingEmails: false,
                saveHistory: true,
                aiModel: 'cyanix-pro',
                responseLength: 'medium'
            }
        }, { merge: true });
        
        showToast('Signed in with Microsoft!', 'success');
    } catch (error) {
        showToast(getFirebaseError(error), 'error');
    }
}

function signUpWithGoogle() {
    signInWithGoogle();
}

function signUpWithMicrosoft() {
    signInWithMicrosoft();
}

function showForgotPassword() {
    const email = prompt("Enter your email to reset password:");
    if (email && validateEmail(email)) {
        auth.sendPasswordResetEmail(email)
            .then(() => {
                showToast('Password reset email sent!', 'success');
            })
            .catch((error) => {
                showToast(getFirebaseError(error), 'error');
            });
    } else if (email) {
        showToast('Please enter a valid email', 'error');
    }
}

// ==================== UI FUNCTIONS ====================
function showChatInterface() {
    document.getElementById('authContainer').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('chatContainer').classList.add('active');
        
        // Update user info
        if (currentUser) {
            document.getElementById('userName').textContent = currentUser.name;
            document.getElementById('userEmail').textContent = currentUser.email;
            document.getElementById('userAvatar').textContent = currentUser.avatar;
        }
    }, 500);
}

function showAuth() {
    document.getElementById('chatContainer').classList.remove('active');
    document.getElementById('authContainer').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('authContainer').style.opacity = '1';
    }, 10);
    document.getElementById('otpForm').style.display = 'none';
    switchAuthTab('signin');
}

function newChat() {
    currentChatId = null;
    conversationHistory = [];
    attachedFiles = [];
    updateAttachedFilesPreview();
    document.getElementById('messagesContainer').innerHTML = '';
    document.getElementById('chatTitle').textContent = 'New Chat';
    
    // Show welcome screen
    const welcomeScreen = document.getElementById('welcomeScreen').cloneNode(true);
    welcomeScreen.style.display = 'block';
    document.getElementById('messagesContainer').appendChild(welcomeScreen);
}

function useExample(type) {
    const examples = {
        brainstorm: "Help me brainstorm creative project ideas for a tech startup that combines AI with environmental sustainability.",
        explain: "Explain quantum computing in simple terms. How does it differ from classical computing, and what are its potential applications?",
        code: "Write a Python function to sort a list using quicksort algorithm. Include comments explaining each step and provide example usage.",
        analyze: "Analyze the pros and cons of renewable energy sources (solar, wind, hydro) compared to fossil fuels. Consider factors like cost, efficiency, environmental impact, and scalability."
    };

    document.getElementById('chatInput').value = examples[type];
    autoResizeInput(document.getElementById('chatInput'));
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message && attachedFiles.length === 0) return;
    
    // Hide welcome screen
    document.getElementById('welcomeScreen')?.remove();
    
    // Handle file uploads if any
    let uploadedFiles = [];
    if (attachedFiles.length > 0) {
        uploadedFiles = await uploadFilesToStorage(attachedFiles);
        attachedFiles = [];
        updateAttachedFilesPreview();
    }
    
    // Add user message
    addMessageToUI(message, 'user', uploadedFiles);
    conversationHistory.push({ role: 'user', content: message });
    
    // Clear input
    input.value = '';
    autoResizeInput(input);
    
    // Show typing indicator if there's a text message
    if (message) {
        showTypingIndicator();
        
        try {
            // Create conversation in Firestore if doesn't exist
            if (!currentChatId) {
                const conversationRef = await db.collection('conversations').add({
                    userId: currentUser.uid,
                    title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                currentChatId = conversationRef.id;
                document.getElementById('chatTitle').textContent = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            }
            
            // Save user message
            await db.collection('messages').add({
                conversationId: currentChatId,
                userId: currentUser.uid,
                content: message,
                sender: 'user',
                files: uploadedFiles.map(f => ({
                    fileName: f.fileName,
                    fileType: f.fileType,
                    fileSize: f.fileSize,
                    downloadURL: f.downloadURL
                })),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update conversation title if it's the first message
            if (document.getElementById('chatTitle').textContent === 'New Chat') {
                await db.collection('conversations').doc(currentChatId).update({
                    title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Generate AI response using Cyanix API if there's a message
            let aiResponse = null;
            if (message) {
                try {
                    aiResponse = await callCyanixAPI(message, uploadedFiles);
                } catch (apiError) {
                    console.error('Cyanix API failed:', apiError);
                    hideTypingIndicator();
                    showToast(`API Error: ${apiError.message}`, 'error');
                    return;
                }
            }
            
            hideTypingIndicator();
            
            // Add AI response if there is one
            if (aiResponse) {
                addMessageToUI(aiResponse, 'assistant');
                conversationHistory.push({ role: 'assistant', content: aiResponse });
                
                // Save AI response
                await db.collection('messages').add({
                    conversationId: currentChatId,
                    userId: currentUser.uid,
                    content: aiResponse,
                    sender: 'assistant',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            hideTypingIndicator();
            showToast('Error: ' + error.message, 'error');
        }
    }
}

async function uploadFilesToStorage(files) {
    if (!currentChatId) {
        const conversationRef = await db.collection('conversations').add({
            userId: currentUser.uid,
            title: 'Files Upload',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        currentChatId = conversationRef.id;
        document.getElementById('chatTitle').textContent = 'Files Upload';
    }

    const uploadedFiles = [];
    
    for (const file of files) {
        try {
            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const fileName = `${timestamp}_${randomString}_${file.name}`;
            
            // Create storage reference
            const storageRef = storage.ref();
            const fileRef = storageRef.child(`conversations/${currentChatId}/${fileName}`);
            
            // Upload file
            const uploadTask = fileRef.put(file);
            
            // Wait for upload to complete
            const snapshot = await uploadTask;
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Create file data object
            const fileData = {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                downloadURL: downloadURL,
                storagePath: snapshot.ref.fullPath
            };
            
            uploadedFiles.push(fileData);
            
            // Save file info to Firestore
            await db.collection('files').add({
                ...fileData,
                conversationId: currentChatId,
                userId: currentUser.uid,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
        } catch (error) {
            console.error('Error uploading file:', error);
            showToast(`Error uploading ${file.name}: ${error.message}`, 'error');
        }
    }
    
    return uploadedFiles;
}

function addMessageToUI(content, sender, files = []) {
    const container = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${sender}`;
    
    let filesHTML = '';
    if (files && files.length > 0) {
        filesHTML = '<div class="message-files">';
        files.forEach((file, index) => {
            const fileInfo = getFileInfo(file);
            if (file.fileType.startsWith('image/')) {
                filesHTML += `
                    <div class="message-file" onclick="openFilePreviewModal(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="${fileInfo.icon} message-file-icon" style="color: ${fileInfo.color};"></i>
                        <div class="message-file-info">
                            <div class="message-file-name">${file.fileName}</div>
                            <div class="message-file-size">${formatFileSize(file.fileSize)}</div>
                        </div>
                    </div>
                `;
            } else {
                filesHTML += `
                    <div class="message-file" onclick="openFilePreviewModal(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                        <i class="${fileInfo.icon} message-file-icon" style="color: ${fileInfo.color};"></i>
                        <div class="message-file-info">
                            <div class="message-file-name">${file.fileName}</div>
                            <div class="message-file-size">${formatFileSize(file.fileSize)}</div>
                        </div>
                    </div>
                `;
            }
        });
        filesHTML += '</div>';
    }
    
    // Add image previews for image files
    let imagesHTML = '';
    if (files && files.length > 0) {
        files.forEach((file, index) => {
            if (file.fileType.startsWith('image/')) {
                imagesHTML += `
                    <img src="${file.downloadURL}" 
                         class="message-image" 
                         alt="${file.fileName}"
                         onclick="openFilePreviewModal(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                `;
            }
        });
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar ${sender}">
                ${sender === 'user' ? (currentUser?.avatar || 'U') : 'AI'}
            </div>
            <div class="message-sender">
                ${sender === 'user' ? (currentUser?.name || 'You') : getModelDisplayName(selectedModel)}
            </div>
        </div>
        <div class="message-content">
            ${content ? formatMessage(content) : ''}
            ${filesHTML}
            ${imagesHTML}
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    const typingDiv = document.createElement('div');
    
    typingDiv.className = 'message assistant';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar assistant">AI</div>
            <div class="message-sender">${getModelDisplayName(selectedModel)}</div>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(20px)';
        setTimeout(() => {
            if (indicator && indicator.parentElement) {
                indicator.remove();
            }
        }, 300);
    }
}

// ==================== UTILITY FUNCTIONS ====================
function autoResizeInput(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = newHeight + 'px';
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function formatMessage(text) {
    if (!text) return '';
    // Convert markdown-like syntax to HTML
    let formatted = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
        .replace(/- (.*?)(?=\n|$)/g, '• $1<br>');
    
    return formatted;
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
              type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : 
              type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' :
              '<i class="fas fa-info-circle"></i>'}
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 500);
        }
    }, 5000);
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function getAvatarInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getFirebaseError(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'Email already in use';
        case 'auth/weak-password':
            return 'Password is too weak';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection';
        default:
            return error.message || 'An error occurred';
    }
}

function showUserMenu() {
    if (confirm('Do you want to logout?')) {
        auth.signOut()
            .then(() => {
                showToast('Logged out successfully', 'success');
            })
            .catch((error) => {
                showToast('Error logging out', 'error');
            });
    }
}

function exportConversation() {
    if (conversationHistory.length === 0) {
        showToast('No conversation to export', 'warning');
        return;
    }

    let exportText = `Cyanix AI Conversation Export\nDate: ${new Date().toLocaleString()}\nModel: ${getModelDisplayName(selectedModel)}\n\n`;
    
    conversationHistory.forEach((msg, index) => {
        exportText += `${msg.role === 'user' ? 'You' : 'AI'}: ${msg.content}\n\n`;
    });

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyanix-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Conversation exported successfully!', 'success');
}

function clearChat() {
    if (confirm('Are you sure you want to clear this chat?')) {
        conversationHistory = [];
        attachedFiles = [];
        updateAttachedFilesPreview();
        document.getElementById('messagesContainer').innerHTML = '';
        showToast('Chat cleared', 'info');
    }
}

function loadChat(chatId) {
    showToast('Loading chat...', 'info');
    // In a real implementation, you would load the chat from Firestore
    newChat();
}