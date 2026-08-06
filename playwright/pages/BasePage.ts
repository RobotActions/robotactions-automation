import { type Page, type Locator, expect } from '@playwright/test';

export class BasePage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async open(path: string): Promise<void> {
        await this.page.goto(path);
    }

    async getTitle(): Promise<string> {
        return this.page.title();
    }

    async waitForURL(pattern: string | RegExp): Promise<void> {
        await this.page.waitForURL(pattern);
    }

    async takeScreenshot(name: string): Promise<Buffer> {
        return this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
    }
}
