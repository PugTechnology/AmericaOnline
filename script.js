document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const icons = document.querySelectorAll('.desktop-icon');
    let selectedIcon = null;

    // --- Window Management ---
    const windows = document.querySelectorAll('.window');

    function openWindow(windowId) {
        const windowElement = document.getElementById(windowId);
        if (windowElement) {
            windowElement.style.display = 'block'; // Or 'flex' if using flex for window layout
            // Potentially bring to front if multiple windows are managed

            if (windowId === 'aol-window') {
                const dialUpSound = document.getElementById('dial-up-sound');
                if (dialUpSound) {
                    dialUpSound.currentTime = 0; // Rewind to start
                    dialUpSound.play().catch(e => console.error("Error playing sound:", e));
                }
            }
        } else {
            console.error(`Window with ID ${windowId} not found.`);
        }
    }

    function closeWindow(windowElement) {
        if (windowElement) {
            windowElement.style.display = 'none';
            if (windowElement.id === 'aol-window') {
                const dialUpSound = document.getElementById('dial-up-sound');
                if (dialUpSound && !dialUpSound.paused) {
                    dialUpSound.pause();
                    dialUpSound.currentTime = 0; // Reset for next time
                }
            }
        }
    }

    windows.forEach(win => {
        const closeBtn = win.querySelector('.close-btn');
        const minimizeBtn = win.querySelector('.minimize-btn');
        const maximizeBtn = win.querySelector('.maximize-btn');
        const titleBar = win.querySelector('.title-bar'); // For dragging later

        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                closeWindow(win);
            });
        }

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Minimize button clicked for window:', win.id);
                // Future: Implement minimize functionality
            });
        }

        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Maximize button clicked for window:', win.id);
                // Future: Implement maximize functionality
            });
        }

        // Placeholder for window dragging logic (optional stretch goal)
        if (titleBar) {
            // Basic drag functionality can be added here.
            // This is a simplified version.
            let isDragging = false;
            let offsetX, offsetY;

            titleBar.addEventListener('mousedown', (e) => {
                isDragging = true;
                offsetX = e.clientX - win.offsetLeft;
                offsetY = e.clientY - win.offsetTop;
                win.style.zIndex = (parseInt(win.style.zIndex || '0', 10) + 1).toString(); // Bring to front
                desktop.querySelectorAll('.window').forEach(otherWin => {
                    if(otherWin !== win && otherWin.style.zIndex >= win.style.zIndex) {
                        otherWin.style.zIndex = (parseInt(otherWin.style.zIndex, 10) -1).toString();
                    }
                });

            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    win.style.left = `${e.clientX - offsetX}px`;
                    win.style.top = `${e.clientY - offsetY}px`;
                }
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            titleBar.addEventListener('dragstart', (e) => e.preventDefault()); // Prevent default drag
        }
    });

    // --- Icon Management ---
    function deselectAllIcons() {
        icons.forEach(icon => icon.classList.remove('selected'));
        selectedIcon = null;
    }

    desktop.addEventListener('click', (event) => {
        if (event.target === desktop) {
            deselectAllIcons();
        }
    });

    icons.forEach(icon => {
        icon.addEventListener('click', (event) => {
            event.stopPropagation();
            deselectAllIcons();
            icon.classList.add('selected');
            selectedIcon = icon;
        });

        icon.addEventListener('dblclick', (event) => {
            event.stopPropagation();
            const iconId = icon.id || 'Unnamed icon';
            const iconName = icon.querySelector('span')?.textContent || iconId;
            console.log(`${iconName} double-clicked`);

            if (icon.id === 'aol-icon') {
                console.log('Attempting to launch AOL...');
                openWindow('aol-window'); // Open the AOL window
            }
            // Add more specific double-click actions for other icons if needed
        });
    });

    // Initial deselection
    deselectAllIcons();
});
