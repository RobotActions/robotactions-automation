/**
 * Base page for mobile automation.
 * Includes helpers for touch gestures, app lifecycle, and app install.
 */
export default class Page {
    async waitForElement(selector: string, timeout: number = 10000) {
        const element = $(selector);
        await element.waitForDisplayed({ timeout });
        return element;
    }

    async tap(selector: string) {
        const el = await this.waitForElement(selector);
        await el.click();
    }

    async typeText(selector: string, text: string) {
        const el = await this.waitForElement(selector);
        await el.setValue(text);
    }

    async getText(selector: string): Promise<string> {
        const el = await this.waitForElement(selector);
        return el.getText();
    }

    async isDisplayed(selector: string): Promise<boolean> {
        try {
            const el = $(selector);
            return await el.isDisplayed();
        } catch {
            return false;
        }
    }

    async swipe(direction: 'up' | 'down' | 'left' | 'right') {
        const { width, height } = await browser.getWindowSize();
        const anchors = {
            up:    { startX: width/2, startY: height*0.8, endX: width/2, endY: height*0.2 },
            down:  { startX: width/2, startY: height*0.2, endX: width/2, endY: height*0.8 },
            left:  { startX: width*0.8, startY: height/2, endX: width*0.2, endY: height/2 },
            right: { startX: width*0.2, startY: height/2, endX: width*0.8, endY: height/2 },
        };
        const { startX, startY, endX, endY } = anchors[direction];
        await browser.performActions([{
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
                { type: 'pointerMove', duration: 0, x: Math.round(startX), y: Math.round(startY) },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 100 },
                { type: 'pointerMove', duration: 500, x: Math.round(endX), y: Math.round(endY) },
                { type: 'pointerUp', button: 0 },
            ],
        }]);
        await browser.releaseActions();
    }

    // ─── App lifecycle & install ─────────────────────────────────────────

    /**
     * Install an app from a local path or URL.
     * Android: .apk   iOS: .ipa / .app
     */
    async installApp(appPath: string) {
        await driver.installApp(appPath);
    }

    /**
     * Remove (uninstall) an app by bundle/package ID.
     */
    async removeApp(appId: string) {
        await driver.removeApp(appId);
    }

    /**
     * Check if an app is installed on the device.
     */
    async isAppInstalled(appId: string): Promise<boolean> {
        return driver.isAppInstalled(appId);
    }

    /**
     * Launch an app that is already installed.
     */
    async launchApp(appId?: string) {
        const id = appId || process.env.BUNDLE_ID || process.env.APP_PACKAGE || '';
        await driver.activateApp(id);
    }

    /**
     * Terminate a running app.
     */
    async terminateApp(appId?: string) {
        const id = appId || process.env.BUNDLE_ID || process.env.APP_PACKAGE || '';
        await driver.terminateApp(id);
    }

    /**
     * Push a file to the device (Android only).
     * @param devicePath - e.g. '/sdcard/Download/test.apk'
     * @param base64Data - file content as base64 string
     */
    async pushFile(devicePath: string, base64Data: string) {
        await driver.pushFile(devicePath, base64Data);
    }

    /**
     * Pull a file from the device.
     * Returns base64-encoded content.
     */
    async pullFile(devicePath: string): Promise<string> {
        return driver.pullFile(devicePath);
    }
}
