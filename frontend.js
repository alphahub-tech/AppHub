frontend integration







// Replace email submission
async function submitEmail() {
    const email = document.getElementById('userEmail').value;
    const response = await fetch('http://localhost:3001/api/submit-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });
    
    if (response.ok) {
        localStorage.setItem('emailSubmitted', 'true');
        document.getElementById('emailModal').classList.add('hidden');
    }
}

// Replace download function
async function downloadApp(appName) {
    const email = localStorage.getItem('userEmail');
    if (!email) return showEmailModal();
    
    // Track download
    await fetch('http://localhost:3001/api/track-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, email, platform: 'web' })
    });
    
    // Redirect to actual download
    window.location.href = `http://localhost:3001/downloads/apps/${appName}-installer.exe`;
}
