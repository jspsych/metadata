import "@testing-library/jest-dom";

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

// jsdom doesn't implement object URLs (used by the Review download buttons).
URL.createObjectURL = jest.fn(() => "blob:mock-url");
URL.revokeObjectURL = jest.fn();

beforeEach(() => {
  localStorage.clear();
});
