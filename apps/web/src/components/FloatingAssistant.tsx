import { RobotOutlined, CloseOutlined } from '@ant-design/icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AgentChatPanel } from './AgentChatPanel';

const DRAG_THRESHOLD = 5;
const ICON = 56;
const PANEL_W = 480;
const PANEL_H = 620;
const GAP = 16;
const EDGE = 16;

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - ICON - EDGE,
    y: window.innerHeight - ICON - EDGE,
  }));
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    moved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      moved.current = true;
    }
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - ICON, posStart.current.x + dx)),
      y: Math.max(0, Math.min(window.innerHeight - ICON, posStart.current.y + dy)),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleClick = useCallback(() => {
    if (!moved.current) {
      setOpen((prev) => !prev);
    }
  }, []);

  // Smart panel positioning: keep panel fully within viewport based on icon position
  const panelStyle = useMemo(() => {
    const iconRight = pos.x + ICON;
    const iconBottom = pos.y + ICON;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const style: React.CSSProperties = {};

    // Horizontal: prefer right-aligned with icon, fallback to left-aligned
    const roomRight = vw - iconRight >= PANEL_W;
    if (roomRight) {
      // Panel's right edge aligns with icon's right edge, clamped to viewport
      style.right = Math.max(EDGE, vw - iconRight);
    } else if (pos.x >= PANEL_W + GAP) {
      // Panel's right edge aligns with icon's left edge
      style.right = vw - pos.x + GAP;
    } else {
      // Not enough room on either side — center horizontally
      style.left = Math.max(EDGE, (vw - PANEL_W) / 2);
    }

    // Vertical: prefer above icon, fallback to below
    const roomAbove = pos.y >= PANEL_H + GAP;
    if (roomAbove) {
      // Panel bottom edge just above icon
      style.bottom = vh - pos.y + GAP;
    } else if (vh - iconBottom >= PANEL_H + GAP) {
      // Panel top edge just below icon
      style.top = iconBottom + GAP;
    } else {
      // Not enough room above or below — center vertically near icon
      style.bottom = Math.max(EDGE, vh - pos.y + GAP);
    }

    return style;
  }, [pos.x, pos.y]);

  return (
    <>
      {/* Draggable icon */}
      <div
        className="group fixed z-[9999] grid h-14 w-14 cursor-grab place-items-center rounded-2xl bg-gradient-to-br from-brand to-teal-500 shadow-[0_6px_24px_rgba(15,118,110,0.4)] transition-all duration-200 hover:shadow-[0_8px_32px_rgba(15,118,110,0.55)] hover:scale-105 active:cursor-grabbing active:scale-95 active:shadow-[0_4px_16px_rgba(15,118,110,0.5)] select-none"
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        {/* Glow ring when closed */}
        {!open && (
          <span className="absolute inset-0 rounded-2xl bg-brand/20 animate-ping opacity-60" />
        )}
        {open ? (
          <CloseOutlined className="relative text-xl text-white" />
        ) : (
          <RobotOutlined className="relative text-xl text-white" />
        )}
        {/* Hover label */}
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none shadow-lg">
          {open ? '关闭助手' : 'AI 助手'}
        </span>
      </div>

      {/* Chat panel popup */}
      {open ? (
        <div
          className="fixed z-[9998] w-[480px] animate-scale-in"
          style={panelStyle}
        >
          <AgentChatPanel onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
