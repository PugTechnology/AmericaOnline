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
                // Add to taskbar if not already there
                if (!document.getElementById('taskbar-aol')) {
                    const activeProgramsContainer = document.getElementById('active-programs');
                    const aolTaskbarItem = document.createElement('button'); // Using button for semantics
                    aolTaskbarItem.id = 'taskbar-aol';
                    aolTaskbarItem.className = 'taskbar-item';
                    aolTaskbarItem.textContent = 'America Online';
                    // Optional: Add click listener for future focus/minimize
                    aolTaskbarItem.addEventListener('click', () => {
                        const aolWin = document.getElementById('aol-window');
                        if (aolWin) {
                            // Make sure it's visible
                            aolWin.style.display = 'block'; 

                            // Bring to front (adjust z-index)
                            // Find the highest current z-index among windows
                            let maxZ = 0;
                            document.querySelectorAll('.window').forEach(w => {
                                const z = parseInt(w.style.zIndex || '0', 10);
                                if (z > maxZ) {
                                    maxZ = z;
                                }
                            });
                            // Set the AOL window to be on top of all others
                            aolWin.style.zIndex = (maxZ + 1).toString();
                            
                            console.log('AOL taskbar item clicked. Window focused.');
                        }
                    });
                    activeProgramsContainer.appendChild(aolTaskbarItem);
                }
                // Play sound (this part should already be there)
                const dialUpSound = document.getElementById('dial-up-sound');
                if (dialUpSound) {
                    dialUpSound.currentTime = 0;
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
                // Remove from taskbar
                const aolTaskbarItem = document.getElementById('taskbar-aol');
                if (aolTaskbarItem) {
                    aolTaskbarItem.remove();
                }
                // Stop sound (this part should already be there)
                const dialUpSound = document.getElementById('dial-up-sound');
                if (dialUpSound && !dialUpSound.paused) {
                    dialUpSound.pause();
                    dialUpSound.currentTime = 0;
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

    // --- System Time in Taskbar ---
    const systemTimeElement = document.getElementById('system-time');

    function updateSystemTime() {
        if (!systemTimeElement) return; // Guard clause

        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        // const seconds = now.getSeconds().toString().padStart(2, '0'); // Optional: add seconds
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // Hour '0' should be '12'
        const hoursStr = hours.toString().padStart(2, '0');
        
        // systemTimeElement.textContent = `${hoursStr}:${minutes}:${seconds} ${ampm}`; // With seconds
        systemTimeElement.textContent = `${hoursStr}:${minutes} ${ampm}`; // Without seconds
    }

    // Initial call to display time immediately
    updateSystemTime();
    // Update time every second
    setInterval(updateSystemTime, 1000);

    // --- Start Menu Functionality ---
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');

    if (startButton && startMenu) {
        startButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from closing menu immediately
            const isVisible = startMenu.style.display === 'block';
            startMenu.style.display = isVisible ? 'none' : 'block';
        });

        // Close Start Menu if clicking outside
        document.addEventListener('click', (event) => {
            if (startMenu.style.display === 'block') {
                // Check if the click was outside the start menu and not on the start button
                if (!startMenu.contains(event.target) && event.target !== startButton) {
                    startMenu.style.display = 'none';
                }
            }
        });
    }
});
