import { WebContainer } from '@webcontainer/api';

let webContainerInstance;
let bootPromise; // This acts as a lock to prevent multiple boots

export const getWebContainer = async () => {
    // If the instance already exists, return it immediately.
    if (webContainerInstance) {
        return webContainerInstance;
    }

    // If a boot is already in progress, return the existing promise.
    if (bootPromise) {
        return bootPromise;
    }

    // If it's the first call, start the boot process and store the promise.
    bootPromise = WebContainer.boot();

    try {
        // Await the promise to get the instance
        webContainerInstance = await bootPromise;
        console.log("WebContainer initialized successfully.");
        return webContainerInstance;
    } catch (error) {
        console.error("WebContainer boot failed:", error);
        // In case of an error, reset the promise so a retry is possible.
        bootPromise = undefined;
        throw error;
    }
};