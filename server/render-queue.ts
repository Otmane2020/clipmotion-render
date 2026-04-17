import {
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { isStorageConfigured, uploadAndClean } from "./storage";

export interface RenderJobData {
  compositionId: string;
  inputProps: Record<string, unknown>;
  webhookUrl?: string;
  format?: "mp4" | "webm" | "gif";
  crf?: number;       // H.264 CRF: lower = better quality. Default 18
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
}

type JobState =
  | { status: "pending";      data: RenderJobData; cancel: () => void }
  | { status: "queued";       data: RenderJobData; cancel: () => void }
  | { status: "in-progress";  progress: number; data: RenderJobData; cancel: () => void }
  | { status: "completed";    videoUrl: string; data: RenderJobData }
  | { status: "failed";       error: string; data: RenderJobData };

function postWebhook(url: string, body: object) {
  try {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    });
    req.write(payload);
    req.end();
  } catch (_) {}
}

export const makeRenderQueue = ({
  port,
  serveUrl,
  rendersDir,
  concurrency = 2,
}: {
  port: number;
  serveUrl: string;
  rendersDir: string;
  concurrency?: number;
}) => {
  const jobs = new Map<string, JobState>();
  let activeRenders = 0;
  const pending: string[] = [];

  const processRender = async (jobId: string) => {
    activeRenders++;
    const job = jobs.get(jobId)!;
    const { cancel, cancelSignal } = makeCancelSignal();

    jobs.set(jobId, { status: "in-progress", progress: 0, cancel, data: job.data });

    const outputPath = path.join(rendersDir, `${jobId}.mp4`);

    try {
      let composition = await selectComposition({
        serveUrl,
        id: job.data.compositionId,
        inputProps: job.data.inputProps,
      });

      // Override dimensions for reel/square/custom formats
      if (job.data.width || job.data.height) {
        composition = {
          ...composition,
          width:  job.data.width  ?? composition.width,
          height: job.data.height ?? composition.height,
        };
      }

      await renderMedia({
        cancelSignal,
        serveUrl,
        composition,
        inputProps: job.data.inputProps,
        codec: "h264",
        crf: job.data.crf ?? 23,
        concurrency: 1,
        chromiumOptions: { gl: "swiftshader" },
        onProgress: ({ progress }) => {
          jobs.set(jobId, { status: "in-progress", progress, cancel, data: job.data });
        },
        outputLocation: outputPath,
      });

      // Upload to Supabase Storage if configured (Render.com has ephemeral disk)
      let videoUrl: string;
      if (isStorageConfigured()) {
        const fileName = `${jobId}.mp4`;
        videoUrl = await uploadAndClean(outputPath, fileName, true);
      } else {
        videoUrl = `http://localhost:${port}/renders/${jobId}.mp4`;
      }

      jobs.set(jobId, { status: "completed", videoUrl, data: job.data });

      if (job.data.webhookUrl) {
        postWebhook(job.data.webhookUrl, { jobId, status: "completed", videoUrl });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      jobs.set(jobId, { status: "failed", error, data: job.data });
      if (job.data.webhookUrl) {
        postWebhook(job.data.webhookUrl, { jobId, status: "failed", error });
      }
    } finally {
      activeRenders--;
      drainQueue();
    }
  };

  function drainQueue() {
    while (activeRenders < concurrency && pending.length > 0) {
      const nextId = pending.shift()!;
      if (jobs.has(nextId)) processRender(nextId);
    }
  }

  function createJob(data: RenderJobData): string {
    const jobId = randomUUID();
    jobs.set(jobId, { status: "queued", data, cancel: () => jobs.delete(jobId) });
    pending.push(jobId);
    drainQueue();
    return jobId;
  }

  // Create a job in "pending" state — won't render until resolveJob() is called
  function createPendingJob(data: RenderJobData): string {
    const jobId = randomUUID();
    jobs.set(jobId, { status: "pending", data, cancel: () => jobs.delete(jobId) });
    return jobId;
  }

  // Transition a pending job to queued (with updated inputProps) and start rendering
  function resolveJob(jobId: string, inputProps: Record<string, unknown>): boolean {
    const job = jobs.get(jobId);
    if (!job || job.status !== "pending") return false;
    const updatedData = { ...job.data, inputProps };
    jobs.set(jobId, { status: "queued", data: updatedData, cancel: () => jobs.delete(jobId) });
    pending.push(jobId);
    drainQueue();
    return true;
  }

  return { createJob, createPendingJob, resolveJob, jobs };
};
