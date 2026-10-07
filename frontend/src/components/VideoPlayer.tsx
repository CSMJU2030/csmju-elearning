"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/csmju";
import { ApiError, api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import type { HeartbeatResult, OutlineVideo } from "@/lib/types";
import { Alert, ProgressBar } from "./states";

/** ส่ง heartbeat ทุก 10 วินาทีระหว่างที่กำลังเรียน — server นับเวลาจริงเอง (ไม่เชื่อตัวเลขจากหน้าเว็บ) */
const HEARTBEAT_MS = 10_000;

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = /^\/(embed|shorts)\/([^/?]+)/.exec(u.pathname);
      return m ? m[2] : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * เครื่องเล่นวิดีโอพร้อมตัวตรวจเวลาเรียน
 * - ไฟล์วิดีโอ (<video>): นับเฉพาะตอนเล่นอยู่ · ซ่อนแท็บแล้วหยุดเล่น · กรอข้ามส่วนที่ยังไม่ได้ดูไม่ได้
 * - YouTube: เบราว์เซอร์รู้สถานะการเล่นไม่ได้ จึงนับเวลาเฉพาะตอนที่หน้านี้แสดงอยู่บนจอ
 */
export default function VideoPlayer({
  video,
  canTrack,
  onProgress,
}: {
  video: OutlineVideo & { videoUrl: string };
  /** false = ดูได้แต่ไม่นับเวลา (เช่น จบสายงานแล้ว) */
  canTrack: boolean;
  onProgress: (result: HeartbeatResult) => void;
}) {
  const ytId = youtubeId(video.videoUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxReached = useRef(video.positionSeconds);
  const [watched, setWatched] = useState(video.watchedSeconds);
  const [completed, setCompleted] = useState(video.state === "COMPLETED");
  const [error, setError] = useState<string | null>(null);
  const tracking = canTrack && !completed;
  // เก็บ callback ไว้ใน ref — parent render ใหม่แล้วตัวจับเวลาต้องไม่เริ่มนับใหม่
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const send = useCallback(
    async (playing: boolean) => {
      if (!canTrack) return;
      const position = Math.floor(videoRef.current?.currentTime ?? 0);
      try {
        const r = await api.post<HeartbeatResult>(`/videos/${video.id}/heartbeats`, { positionSeconds: position, playing });
        setWatched(r.watchedSeconds);
        setError(null);
        if (r.isCompleted) setCompleted(true);
        onProgressRef.current(r);
      } catch (e) {
        if (e instanceof ApiError && e.code !== "UNAUTHORIZED") {
          setError(e.reason === "VIDEO_LOCKED" ? "ต้องเรียนบทเรียนก่อนหน้าให้จบก่อน" : "บันทึกเวลาเรียนไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ");
        }
      }
    },
    [canTrack, video.id],
  );

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(
    (shouldCount: () => boolean) => {
      stop();
      void send(false); // เริ่มจับเวลารอบใหม่
      timer.current = setInterval(() => {
        void send(shouldCount());
      }, HEARTBEAT_MS);
    },
    [send, stop],
  );

  // YouTube: นับขณะหน้าแสดงอยู่
  useEffect(() => {
    if (!ytId || !tracking) return;
    const visible = () => document.visibilityState === "visible";
    start(visible);
    const onVisibility = () => {
      if (visible()) start(visible);
      else {
        void send(true);
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [ytId, tracking, send, start, stop]);

  // ไฟล์วิดีโอ: ซ่อนแท็บ = หยุดเล่น
  useEffect(() => {
    if (ytId) return;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [ytId, stop]);

  const onPlay = () => {
    if (!tracking) return;
    start(() => Boolean(videoRef.current && !videoRef.current.paused));
  };
  const onPauseOrEnd = () => {
    if (!tracking || !timer.current) return;
    stop();
    void send(true); // นับช่วงสุดท้ายก่อนหยุด
  };
  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || el.seeking) return;
    if (el.currentTime <= maxReached.current + 2) maxReached.current = Math.max(maxReached.current, el.currentTime);
  };
  const onSeeking = () => {
    const el = videoRef.current;
    if (!el || completed) return;
    if (el.currentTime > maxReached.current + 2) el.currentTime = maxReached.current;
  };

  const percent = Math.min(100, (watched / video.requiredSeconds) * 100);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl bg-on-surface">
        {ytId ? (
          <iframe
            key={video.id}
            title={video.title}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?rel=0`}
            className="aspect-video w-full"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            key={video.id}
            ref={videoRef}
            src={video.videoUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
            onPlay={onPlay}
            onPause={onPauseOrEnd}
            onEnded={onPauseOrEnd}
            onTimeUpdate={onTimeUpdate}
            onSeeking={onSeeking}
            onLoadedMetadata={() => {
              if (videoRef.current && video.positionSeconds > 0 && video.positionSeconds < video.durationSeconds - 1) {
                videoRef.current.currentTime = video.positionSeconds;
              }
            }}
          >
            เบราว์เซอร์นี้เล่นวิดีโอไม่ได้
          </video>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-headline-md text-on-surface">{video.title}</h2>
          <p className="text-body-md text-on-surface-variant">ความยาว {formatDuration(video.durationSeconds)}</p>
        </div>
        {completed ? <StatusBadge tone="success" label="เรียนจบแล้ว" /> : <StatusBadge tone="info" label="กำลังเรียน" />}
      </div>

      {canTrack && (
        <div aria-live="polite">
          <ProgressBar
            percent={completed ? 100 : percent}
            label={
              completed
                ? "ดูครบเวลาที่กำหนดแล้ว"
                : `เวลาเรียนจริง ${formatDuration(watched)} จากที่ต้องดู ${formatDuration(video.requiredSeconds)}`
            }
          />
          {!completed && (
            <p className="mt-2 text-label-sm text-on-surface-variant">
              {ytId
                ? "ระบบนับเวลาเฉพาะตอนที่หน้านี้เปิดอยู่บนจอ"
                : "ระบบนับเวลาเฉพาะตอนที่วิดีโอเล่นอยู่ และกรอข้ามส่วนที่ยังไม่ได้ดูไม่ได้"}
            </p>
          )}
        </div>
      )}
      {error && <Alert tone="warning">{error}</Alert>}
    </div>
  );
}
