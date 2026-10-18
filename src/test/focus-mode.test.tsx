import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { ScannerSection } from "@/components/pos/ScannerSection";
import { useFocusMode } from "@/components/pos/FocusMode";

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ isRTL: true, t: { pos: { scanPlaceholder: "scan", quickAdd: "add", camera: "camera" } } }),
}));

describe("focus mode scanner capture", () => {
  const scanBox = () => screen.getByPlaceholderText("scan") as HTMLInputElement;

  it("sends keystrokes typed outside any field into the scan box", () => {
    render(
      <div>
        <button>other</button>
        <ScannerSection onScan={() => {}} isSearching={false} captureKeys />
      </div>,
    );
    screen.getByText("other").focus();
    fireEvent.keyDown(window, { key: "3" });
    expect(document.activeElement).toBe(scanBox());
  });

  it("jumps to the scan box with F2", () => {
    render(
      <div>
        <input placeholder="notes" />
        <ScannerSection onScan={() => {}} isSearching={false} captureKeys />
      </div>,
    );
    (screen.getByPlaceholderText("notes") as HTMLInputElement).focus();
    fireEvent.keyDown(window, { key: "F2" });
    expect(document.activeElement).toBe(scanBox());
  });

  it("leaves other fields and open dialogs alone", () => {
    render(
      <div>
        <input placeholder="notes" />
        <ScannerSection onScan={() => {}} isSearching={false} captureKeys />
      </div>,
    );
    const notes = screen.getByPlaceholderText("notes") as HTMLInputElement;
    notes.focus();
    fireEvent.keyDown(window, { key: "a" });
    expect(document.activeElement).toBe(notes);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    notes.blur();
    fireEvent.keyDown(window, { key: "5" });
    expect(document.activeElement).not.toBe(scanBox());
    dialog.remove();
  });

  it("does nothing outside focus mode", () => {
    render(
      <div>
        <button>other</button>
        <ScannerSection onScan={() => {}} isSearching={false} />
      </div>,
    );
    screen.getByText("other").focus();
    fireEvent.keyDown(window, { key: "3" });
    expect(document.activeElement).not.toBe(scanBox());
  });
});

describe("useFocusMode", () => {
  beforeEach(() => localStorage.clear());

  it("remembers the choice on this device", () => {
    const first = renderHook(() => useFocusMode());
    act(() => first.result.current.enter());
    expect(first.result.current.focus).toBe(true);
    first.unmount();

    const again = renderHook(() => useFocusMode());
    expect(again.result.current.focus).toBe(true);
    act(() => again.result.current.exit());
    expect(localStorage.getItem("pos_focus_mode")).toBe("0");
  });

  it("leaves focus mode with Esc unless a dialog is open", () => {
    const { result } = renderHook(() => useFocusMode());
    act(() => result.current.enter());

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(result.current.focus).toBe(true);
    dialog.remove();

    act(() => { fireEvent.keyDown(window, { key: "Escape" }); });
    expect(result.current.focus).toBe(false);
  });
});
