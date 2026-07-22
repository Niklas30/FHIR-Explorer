"use client";

import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";

/**
 * Makes a whole region a file drop target: dropping a file anywhere on the
 * element (not only on a dedicated dropzone) forwards it to `onFiles`. Returns
 * a `isDragging` flag for an overlay and handlers to spread on the container.
 * A capture-phase window listener clears the overlay even when the drop lands
 * on an inner dropzone that stops propagation.
 */
export const usePageFileDrop = (onFiles: (files: File[]) => void) => {
  const [isDragging, setIsDragging] = useState(false);
  const depthRef = useRef(0);

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!hasFiles(event)) return;
    depthRef.current += 1;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    if (hasFiles(event)) event.preventDefault();
  }, []);

  const onDragLeave = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      depthRef.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      onFiles(files);
    },
    [onFiles]
  );

  useEffect(() => {
    const clear = () => {
      depthRef.current = 0;
      setIsDragging(false);
    };
    window.addEventListener("drop", clear, true);
    window.addEventListener("dragend", clear, true);
    return () => {
      window.removeEventListener("drop", clear, true);
      window.removeEventListener("dragend", clear, true);
    };
  }, []);

  return { isDragging, dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
};
