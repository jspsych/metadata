import { act, renderHook } from "@testing-library/react";
import { useTheme } from "../src/hooks/useTheme";

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("useTheme", () => {
  test("defaults to the OS preference when nothing is stored (mocked light)", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  test("honors a stored 'dark' preference", () => {
    localStorage.setItem("theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  test("honors a stored 'light' preference", () => {
    localStorage.setItem("theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);
  });

  test("toggle flips the theme, persists it, and updates the document", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());
    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => result.current.toggle());
    expect(result.current.isDark).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
