import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface DragState {
  id: string;
  from: number;
  over: number;
}

/**
 * Minimal pointer-based list sorting (mouse, pen and touch) without a
 * dependency. The handle captures the pointer; the drop position is the
 * row under the pointer. Arrow keys on the handle move one step, so the
 * same control works from the keyboard.
 */
export function useDragSort(ids: string[], onMove: (from: number, to: number) => void) {
  const rows = useRef(new Map<string, HTMLElement>());
  const current = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const set = (next: DragState | null) => {
    current.current = next;
    setDrag(next);
  };

  const indexAt = (clientY: number): number => {
    let index = 0;
    ids.forEach((id, i) => {
      const rect = rows.current.get(id)?.getBoundingClientRect();
      if (rect && clientY >= rect.top) index = i;
    });
    return index;
  };

  const rowRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) rows.current.set(id, el);
      else rows.current.delete(id);
    },
    [],
  );

  const handleProps = (id: string, index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Capture is a nicety; dragging still works without it.
      }
      set({ id, from: index, over: index });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = current.current;
      if (!d || d.id !== id) return;
      const over = indexAt(e.clientY);
      if (over !== d.over) set({ ...d, over });
    },
    onPointerUp: () => {
      const d = current.current;
      set(null);
      if (d && d.id === id && d.over !== d.from) onMove(d.from, d.over);
    },
    onPointerCancel: () => set(null),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault();
        onMove(index, index - 1);
      } else if (e.key === "ArrowDown" && index < ids.length - 1) {
        e.preventDefault();
        onMove(index, index + 1);
      } else if (e.key === "Escape" && current.current) {
        set(null);
      }
    },
  });

  return { drag, rowRef, handleProps };
}
