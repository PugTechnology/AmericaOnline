document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const icons = document.querySelectorAll('.desktop-icon');
    let selectedIcon = null;

    const appRegistry = {
        // Example for when Paint app is added later:
        // 'paint': {
        //     name: 'Paint Application',
        //     htmlPath: 'apps/paint/paint.html', 
        //     // jsPath: 'apps/paint/paint.js', // For later
        //     // cssPath: 'apps/paint/paint.css' // For later
        // }
    };
    let windowIdCounter = 0; // To generate unique IDs for windows and taskbar items

    // --- Generic Window and Taskbar Helper Functions ---
    function createWindow(appId, appName) {
        windowIdCounter++;
        const windowEl = document.createElement('div');
        windowEl.id = `${appId}-window-${windowIdCounter}`;
        windowEl.className = 'window';
        windowEl.style.display = 'block'; // Show by default, position can be random or cascaded later
        // Set initial position (e.g., slightly offset or random)
        const initialTop = 50 + (windowIdCounter % 5) * 30; // Cascade a bit
        const initialLeft = 50 + (windowIdCounter % 5) * 30;
        windowEl.style.top = `${initialTop}px`;
        windowEl.style.left = `${initialLeft}px`;


        // Title Bar
        const titleBar = document.createElement('div');
        titleBar.className = 'title-bar';
        const titleText = document.createElement('span');
        titleText.className = 'title';
        titleText.textContent = appName;
        const controls = document.createElement('div');
        controls.className = 'title-bar-controls';
        const minBtn = document.createElement('button');
        minBtn.className = 'minimize-btn';
        minBtn.innerHTML = '_'; // Or use Marlett font if set up for it
        const maxBtn = document.createElement('button');
        maxBtn.className = 'maximize-btn';
        maxBtn.innerHTML = '[]'; // Or use Marlett
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = 'X'; // Or use Marlett

        controls.appendChild(minBtn);
        controls.appendChild(maxBtn);
        controls.appendChild(closeBtn);
        titleBar.appendChild(titleText);
        titleBar.appendChild(controls);
        windowEl.appendChild(titleBar);

        // Window Body
        const windowBody = document.createElement('div');
        windowBody.className = 'window-body';
        windowBody.innerHTML = `<p>${appName} content will load here.</p>`; // Placeholder
        windowEl.appendChild(windowBody);

        makeWindowDraggable(windowEl, titleBar);

        // Close button functionality
        closeBtn.addEventListener('click', () => {
            windowEl.remove(); // Remove window from DOM
            const taskbarItemId = `taskbar-${appId}-${windowIdCounter}`;
            const taskbarItem = document.getElementById(taskbarItemId);
            if (taskbarItem) taskbarItem.remove();
        });
        
        minBtn.addEventListener('click', () => {
            windowEl.style.display = 'none';
            const taskbarItemId = `taskbar-${appId}-${windowIdCounter}`;
            const taskbarItem = document.getElementById(taskbarItemId);
            if (taskbarItem) taskbarItem.classList.add('minimized');
            windowEl.dataset.minimized = 'true';
        });

        maxBtn.addEventListener('click', () => console.log('Maximize for ' + windowEl.id)); // Placeholder

        document.getElementById('desktop').appendChild(windowEl);
        return windowEl;
    }
    
    function makeWindowDraggable(windowElement, titleBarElement) {
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        titleBarElement.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only allow left mouse button for dragging

            isDragging = true;
            dragOffsetX = e.clientX - windowElement.offsetLeft;
            dragOffsetY = e.clientY - windowElement.offsetTop;

            // Bring window to front
            let maxZ = 0;
            document.querySelectorAll('.window').forEach(w => {
                const z = parseInt(w.style.zIndex || '0', 10);
                if (z > maxZ) maxZ = z;
            });
            windowElement.style.zIndex = (maxZ + 1).toString();

            e.preventDefault(); // Prevent text selection, etc.

            // Add event listeners for mousemove and mouseup to the document
            // These are named functions so they can be removed specifically.
            document.addEventListener('mousemove', handleDocumentMouseMove);
            document.addEventListener('mouseup', handleDocumentMouseUp);
        });

        function handleDocumentMouseMove(e) {
            if (!isDragging) return;

            let newLeft = e.clientX - dragOffsetX;
            let newTop = e.clientY - dragOffsetY;

            const desktop = document.getElementById('desktop');
            // Constrain to desktop boundaries
            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + windowElement.offsetWidth > desktop.clientWidth) {
                newLeft = desktop.clientWidth - windowElement.offsetWidth;
            }
            if (newTop + windowElement.offsetHeight > desktop.clientHeight) {
                newTop = desktop.clientHeight - windowElement.offsetHeight;
            }

            windowElement.style.left = newLeft + 'px';
            windowElement.style.top = newTop + 'px';
        }

        function handleDocumentMouseUp(e) {
            if (isDragging) {
                isDragging = false;
                // Remove the event listeners from the document
                document.removeEventListener('mousemove', handleDocumentMouseMove);
                document.removeEventListener('mouseup', handleDocumentMouseUp);
            }
        }
    }

    function createTaskbarItem(appId, appName, associatedWindowId) {
        const activeProgramsContainer = document.getElementById('active-programs');
        const taskbarItem = document.createElement('button');
        // Use the windowIdCounter from the time of createWindow for this app instance
        taskbarItem.id = `taskbar-${appId}-${windowIdCounter}`; 
        taskbarItem.className = 'taskbar-item';
        taskbarItem.textContent = appName;

        taskbarItem.addEventListener('click', () => {
            const windowEl = document.getElementById(associatedWindowId);
            if (windowEl) {
                if (windowEl.dataset.minimized === 'true') { 
                    windowEl.style.display = 'block';
                    windowEl.dataset.minimized = 'false';
                    taskbarItem.classList.remove('minimized');
                } else { 
                    windowEl.style.display = 'block'; 
                }
                let maxZ = 0;
                document.querySelectorAll('.window').forEach(w => {
                    const z = parseInt(w.style.zIndex || '0', 10);
                    if (z > maxZ) maxZ = z;
                });
                windowEl.style.zIndex = (maxZ + 1).toString();
            }
        });
        activeProgramsContainer.appendChild(taskbarItem);
        return taskbarItem;
    }

    function launchApplication(appId) {
        const appDetails = appRegistry[appId];
        if (!appDetails) {
            console.error(`App with ID ${appId} not found in registry.`);
            return;
        }

        const newWindow = createWindow(appId, appDetails.name); // windowIdCounter is incremented inside createWindow
        const taskbarItem = createTaskbarItem(appId, appDetails.name, newWindow.id); // Uses the *current* windowIdCounter from newWindow creation
        
        // Close and Minimize buttons in createWindow already handle their taskbar item interactions.
        // Redundant linking for closeBtn and minBtn here is removed.

        const windowBody = newWindow.querySelector('.window-body');
        // Later: fetch(appDetails.htmlPath).then(res=>res.text()).then(html => windowBody.innerHTML = html);

        let maxZ = 0;
        document.querySelectorAll('.window:not(#aol-window)').forEach(w => {
            const z = parseInt(w.style.zIndex || '0', 10);
            if (z > maxZ) maxZ = z;
        });
        newWindow.style.zIndex = (maxZ + 2).toString(); 

        console.log(`Launched ${appDetails.name}`);
    }


    // --- AOL Window Specific Management ---
    const aolWindowElement = document.getElementById('aol-window');
    const aolTitleBarElement = aolWindowElement ? aolWindowElement.querySelector('.title-bar') : null;
    const aolCloseBtn = aolWindowElement ? aolWindowElement.querySelector('.close-btn') : null;
    const aolMinimizeBtn = aolWindowElement ? aolWindowElement.querySelector('.minimize-btn') : null;
    // const aolMaximizeBtn = aolWindowElement ? aolWindowElement.querySelector('.maximize-btn') : null; // If needed

    function openAOLWindow() { // Renamed from openWindow
        if (!aolWindowElement) return;
        aolWindowElement.style.display = 'block'; 

        let aolTaskbarItem = document.getElementById('taskbar-aol');
        if (!aolTaskbarItem) {
            const activeProgramsContainer = document.getElementById('active-programs');
            aolTaskbarItem = document.createElement('button'); 
            aolTaskbarItem.id = 'taskbar-aol';
            aolTaskbarItem.className = 'taskbar-item';
            aolTaskbarItem.textContent = 'America Online';
            
            aolTaskbarItem.addEventListener('click', () => {
                if (aolWindowElement.dataset.minimized === 'true') { 
                    aolWindowElement.style.display = 'block';
                    aolWindowElement.dataset.minimized = 'false';
                    aolTaskbarItem.classList.remove('minimized');
                } else { 
                    aolWindowElement.style.display = 'block'; 
                }
                let maxZ = 0;
                document.querySelectorAll('.window').forEach(w => {
                    const z = parseInt(w.style.zIndex || '0', 10);
                    if (z > maxZ) maxZ = z;
                });
                aolWindowElement.style.zIndex = (maxZ + 1).toString();
            });
            aolWindowElement.dataset.minimized = 'false'; // Ensure this is set when created
            aolTaskbarItem.classList.remove('minimized'); // Ensure this is set when created
            activeProgramsContainer.appendChild(aolTaskbarItem);
        }
        
        let maxZ = 0;
        document.querySelectorAll('.window').forEach(w => {
            const z = parseInt(w.style.zIndex || '0', 10);
            if (z > maxZ) maxZ = z;
        });
        aolWindowElement.style.zIndex = (maxZ + 1).toString();

        const dialUpSound = document.getElementById('dial-up-sound');
        if (dialUpSound) {
            dialUpSound.currentTime = 0;
            dialUpSound.play().catch(e => console.error("Error playing sound:", e));
        }
    }

    if (aolCloseBtn) {
        aolCloseBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!aolWindowElement) return;
            aolWindowElement.style.display = 'none';
            const aolTaskbarItem = document.getElementById('taskbar-aol');
            if (aolTaskbarItem) aolTaskbarItem.remove();
            const dialUpSound = document.getElementById('dial-up-sound');
            if (dialUpSound && !dialUpSound.paused) {
                dialUpSound.pause();
                dialUpSound.currentTime = 0;
            }
        });
    }

    if (aolMinimizeBtn) {
        aolMinimizeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!aolWindowElement) return;
            aolWindowElement.style.display = 'none';
            aolWindowElement.dataset.minimized = 'true'; 
            const taskbarItem = document.getElementById('taskbar-aol');
            if (taskbarItem) taskbarItem.classList.add('minimized');
        });
    }
    
    // Apply draggable to AOL window
    if (aolWindowElement && aolTitleBarElement) {
        makeWindowDraggable(aolWindowElement, aolTitleBarElement);
    }

    // --- Icon Management (Should remain largely the same) ---
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
                openAOLWindow(); // Changed from openWindow('aol-window')
            }
            // Add more specific double-click actions for other icons if needed
            // Example for future app launch:
            // if (icon.id === 'paint-icon') {
            //     launchApplication('paint');
            // }
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

    // --- Draggable Desktop Icons ---
    // const desktop = document.getElementById('desktop'); // Already defined
    // const icons = document.querySelectorAll('.desktop-icon'); // Already defined

    icons.forEach(icon => {
        let isIconDragging = false; // Renamed from isDragging to avoid conflict
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        icon.addEventListener('mousedown', (e) => {
            // Only drag with left mouse button
            if (e.button !== 0) return;

            isIconDragging = true; // Use specific flag
            // Calculate offset from icon's top-left corner to the mouse pointer
            dragOffsetX = e.clientX - icon.offsetLeft;
            dragOffsetY = e.clientY - icon.offsetTop;

            // Set a higher z-index while dragging (optional, but good for UX)
            icon.style.zIndex = '1000'; 

            // Prevent default browser drag behavior for images
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isIconDragging) return; // Use specific flag

            let newLeft = e.clientX - dragOffsetX;
            let newTop = e.clientY - dragOffsetY;

            // Constrain to desktop boundaries
            // const desktopRect = desktop.getBoundingClientRect(); // Not strictly needed if desktop is at 0,0
            // const iconRect = icon.getBoundingClientRect(); // Not strictly needed here

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            
            if (newLeft + icon.offsetWidth > desktop.clientWidth) {
                newLeft = desktop.clientWidth - icon.offsetWidth;
            }
            if (newTop + icon.offsetHeight > desktop.clientHeight) {
                newTop = desktop.clientHeight - icon.offsetHeight;
            }

            icon.style.left = newLeft + 'px';
            icon.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', (e) => {
            if (isIconDragging) { // Use specific flag
                isIconDragging = false;
                icon.style.zIndex = ''; // Reset z-index
            }
        });

        // Prevent text selection on icon labels during drag attempts
        const label = icon.querySelector('span');
        if (label) {
            label.addEventListener('mousedown', (e) => e.preventDefault());
        }
    });
});
