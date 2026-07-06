import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// jsdom doesn't expose TextEncoder/TextDecoder — needed by any code that encodes strings to bytes.
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// jsdom doesn't implement matchMedia (used by useTheme to read the OS color scheme).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// jsdom 20 doesn't implement Blob.prototype.arrayBuffer; polyfill via FileReader.
if (typeof (Blob.prototype as any).arrayBuffer !== 'function') {
  (Blob.prototype as any).arrayBuffer = function(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// jsdom doesn't implement object URLs (used by the Review download buttons).
URL.createObjectURL = jest.fn(() => "blob:mock-url");
URL.revokeObjectURL = jest.fn();

// jsdom doesn't implement <dialog>.showModal/close (used by Sidebar and PreviewDrawer). Stub them
// so modal dialogs render as open and fire their close event on programmatic close.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = jest
    .fn()
    .mockImplementation(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
  HTMLDialogElement.prototype.close = jest
    .fn()
    .mockImplementation(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
}

beforeEach(() => {
  localStorage.clear();
});
