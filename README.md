# WebOS Simulation Project

## Purpose

This project aims to simulate a retro desktop operating system environment, reminiscent of systems like Windows 98, entirely within a web browser. It's an exploration of what's possible with HTML, CSS, and JavaScript to recreate classic UI elements, interactions, and simple applications.

## Current Features

As of now, the WebOS simulation includes:

*   **Desktop Environment:**
    *   Windows 98-style desktop background and layout.
    *   Taskbar with a functional Start button and system clock (displaying the user's current time).
    *   Desktop icons for "America Online," "My Computer," and "Recycle Bin." (Icon dragging to be implemented soon).
*   **Windowing System:**
    *   Basic window management allowing windows to be opened, closed, and dragged.
    *   Active windows are brought to the front (basic z-index management).
*   **Start Menu:**
    *   A functional Start Menu that lists mock application entries.
*   **Applications & Interactions:**
    *   **America Online (AOL) Simulation:**
        *   Double-clicking the AOL desktop icon opens a simulated AOL application window.
        *   Plays a dial-up modem sound upon launching.
        *   The AOL application appears as an active item in the taskbar. Clicking this item focuses the AOL window.
    *   Other desktop icons are currently placeholders for future functionality.

## Tech Stack & Requirements

*   **Core Technologies:** HTML, CSS, JavaScript (ES6+)
*   **Requirements:** A modern web browser that supports these technologies.
*   **Assets:** The simulation uses local image files (`img/*.png`) and audio files (`audio/*.mp3`). These must be placed in the respective `img/` and `audio/` directories in the project root.

## How to Run

1.  Ensure you have the necessary image and audio assets in appropriately named `img/` and `audio/` folders in the project's root directory.
    *   Required images (examples): `aol-icon.png`, `my-computer-icon.png`, `recycle-bin-icon.png`, `aol-logo.png`.
    *   Required audio: `dialup.mp3`.
2.  Open the `index.html` file in a modern web browser.

## Future Ideas & Roadmap

This project has a lot of potential for expansion! Here are some of the exciting features planned or envisioned:

*   **Core OS Enhancements:**
    *   Draggable desktop icons with persistent positions (using browser local storage).
    *   Full minimize and restore functionality for application windows via the taskbar.
    *   A more robust application framework for easier integration of new apps.
    *   A system boot-up sequence (BIOS, OS loading screen) with a skip option.
    *   Deeper use of browser local storage for user preferences and data persistence.
*   **New Applications:**
    *   **Paint:** A simple drawing application.
    *   **Solitaire:** The classic card game.
    *   **Notepad:** A basic text editor.
*   **Application Enhancements:**
    *   **AOL:**
        *   Interactive login sequence with a "running man" animation (using sequential static images).
        *   Mock internal AOL screens after "login."
    *   **My Computer:**
        *   Display a mock "C:" drive.
        *   Simulate files and folders based on data stored in the browser's local storage, allowing for basic file system emulation.
*   **Advanced Features:**
    *   A more sophisticated application "installation" or management system within the WebOS.
    *   Themes or appearance customization.
    *   Basic file operations within "My Computer" (create mock files/folders).

## Contributing (Optional)

(If you're open to contributions, outline how others can contribute here.)

---

*This README will be updated as the project progresses.*
