"use client";

import NextImage from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type GuessResponse = {
  guess?: string;
  rawText?: string;
  error?: string;
};

const FIXED_MODEL = { provider: "zhipu" as const, model: "glm-4.6v" };

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const [lineWidth, setLineWidth] = useState(10);
  const [isErasing, setIsErasing] = useState(false);
  const [isGuessing, setIsGuessing] = useState(false);
  const [handwritingMode, setHandwritingMode] = useState(false);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [latestGuess, setLatestGuess] = useState("还没有猜测结果，先画一笔吧。");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111111";
    context.lineWidth = 10;
    historyRef.current = [canvas.toDataURL("image/png")];
  }, []);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.lineWidth = lineWidth;
  }, [lineWidth]);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.strokeStyle = isErasing ? "#ffffff" : "#111111";
  }, [isErasing]);

  const pushHistorySnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snapshot = canvas.toDataURL("image/png");
    const stack = historyRef.current;
    if (stack[stack.length - 1] === snapshot) return;
    stack.push(snapshot);
    if (stack.length > 50) {
      stack.shift();
    }
  };

  const restoreFromSnapshot = (snapshot: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = new Image();
    image.onload = () => {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = snapshot;
  };

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    canvas.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    pushHistorySnapshot();
    context.beginPath();
    context.moveTo(point.x, point.y);
    isDrawingRef.current = true;
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;

    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.closePath();
    isDrawingRef.current = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    pushHistorySnapshot();
    setLatestGuess("画布已清空。");
    setError(null);
  };

  const undoLastStep = () => {
    const stack = historyRef.current;
    if (stack.length <= 1) return;
    stack.pop();
    const previous = stack[stack.length - 1];
    if (!previous) return;
    restoreFromSnapshot(previous);
    setError(null);
  };

  const getCanvasBase64 = () => {
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas) return null;

    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) return null;

    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    const pixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data;
    let minX = sourceWidth;
    let minY = sourceHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sourceHeight; y += 1) {
      for (let x = 0; x < sourceWidth; x += 1) {
        const index = (y * sourceWidth + x) * 4;
        const r = pixels[index] ?? 255;
        const g = pixels[index + 1] ?? 255;
        const b = pixels[index + 2] ?? 255;
        const a = pixels[index + 3] ?? 0;
        const isStroke = a > 0 && (r < 245 || g < 245 || b < 245);
        if (!isStroke) continue;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1024;
    exportCanvas.height = 1024;
    const exportContext = exportCanvas.getContext("2d");
    if (!exportContext) return null;

    exportContext.fillStyle = "#ffffff";
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportContext.imageSmoothingEnabled = true;
    exportContext.imageSmoothingQuality = "high";

    if (maxX >= minX && maxY >= minY) {
      const cropPadding = 24;
      const sx = Math.max(0, minX - cropPadding);
      const sy = Math.max(0, minY - cropPadding);
      const sw = Math.min(sourceWidth - sx, maxX - minX + 1 + cropPadding * 2);
      const sh = Math.min(sourceHeight - sy, maxY - minY + 1 + cropPadding * 2);

      const targetPadding = 64;
      const targetSize = exportCanvas.width - targetPadding * 2;
      const scale = Math.min(targetSize / sw, targetSize / sh);
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));
      const dx = Math.floor((exportCanvas.width - dw) / 2);
      const dy = Math.floor((exportCanvas.height - dh) / 2);

      exportContext.drawImage(sourceCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      exportContext.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    }

    const dataUrl = exportCanvas.toDataURL("image/png");
    return dataUrl.split(",")[1] ?? null;
  };

  const requestGuessByImage = async (imageBase64: string) => {
    setError(null);
    setIsGuessing(true);
    try {
      const response = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          provider: FIXED_MODEL.provider,
          model: FIXED_MODEL.model,
          taskMode: handwritingMode ? "handwriting" : "general",
        }),
      });

      const payload = (await response.json()) as GuessResponse;
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "AI 猜测失败。");
      }

      setLatestGuess(payload.guess ?? payload.rawText ?? "没有拿到猜测结果。");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "请求失败。";
      setLatestGuess("没有识别出来。");
      setError(message);
    } finally {
      setIsGuessing(false);
    }
  };

  const requestGuess = async () => {
    const imageBase64 = getCanvasBase64();
    if (!imageBase64) {
      setError("无法读取画布图像。");
      return;
    }
    await requestGuessByImage(imageBase64);
  };

  const requestUploadGuess = async () => {
    if (!uploadedImageBase64) {
      setError("请先上传图片。");
      return;
    }
    await requestGuessByImage(uploadedImageBase64);
  };

  const onUploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("只能上传图片文件。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setError("读取上传图片失败。");
        return;
      }
      const base64 = result.split(",")[1] ?? null;
      if (!base64) {
        setError("读取上传图片失败。");
        return;
      }
      setUploadedImagePreview(result);
      setUploadedImageBase64(base64);
      setError(null);
    };
    reader.onerror = () => setError("读取上传图片失败。");
    reader.readAsDataURL(file);
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(120deg,#f8f7f2_0%,#ebe8dc_100%)] p-4 text-zinc-900">
      <section className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-[1600px] flex-col gap-3 rounded-2xl border border-zinc-300 bg-white/80 p-4 shadow-lg backdrop-blur sm:p-5">
        <h1 className="text-2xl font-bold sm:text-3xl">AI 你画我猜</h1>
        <p className="text-xs text-zinc-700 sm:text-sm">
          在画布上随便画，点击“开始猜测”，由 AI 来猜你画的是什么。
        </p>

        <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-3 sm:p-4">
          <p className="text-sm font-semibold text-zinc-500">最新猜测</p>
          <p className="mt-1 text-xl font-bold sm:text-2xl">{latestGuess}</p>
          {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={clearCanvas}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-100"
          >
            清空
          </button>
          <button
            type="button"
            onClick={undoLastStep}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-100"
          >
            撤销一步
          </button>
          <button
            type="button"
            onClick={() => setIsErasing((value) => !value)}
            className={`rounded-md border px-2 py-1 text-xs ${
              isErasing
                ? "border-amber-600 bg-amber-100 text-amber-800"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {isErasing ? "橡皮擦中" : "橡皮擦"}
          </button>
          <label
            htmlFor="lineWidth"
            className="inline-flex w-32 items-center justify-between text-sm tabular-nums"
          >
            <span>画笔粗细：</span>
            <span className="w-12 text-right">{lineWidth}px</span>
          </label>
          <input
            id="lineWidth"
            type="range"
            min={5}
            max={30}
            value={lineWidth}
            onChange={(event) => setLineWidth(Number(event.target.value))}
          />
          <span className="text-sm text-zinc-700">模型：GLM-4.6V（智谱）</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={handwritingMode}
              onChange={(event) => setHandwritingMode(event.target.checked)}
            />
            手写模式
          </label>
          <button
            type="button"
            onClick={requestGuess}
            disabled={isGuessing}
            className="ml-auto rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            {isGuessing ? "猜测中..." : "开始猜测"}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-3 sm:p-4">
          <p className="text-sm font-semibold text-zinc-600">上传图片识别</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={onUploadImage}
              className="max-w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={requestUploadGuess}
              disabled={isGuessing || !uploadedImageBase64}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isGuessing ? "识别中..." : "识别上传图片"}
            </button>
          </div>
          {uploadedImagePreview ? (
            <NextImage
              src={uploadedImagePreview}
              alt="上传预览"
              width={320}
              height={192}
              className="mt-3 max-h-48 rounded-md border border-zinc-300 object-contain"
            />
          ) : null}
        </div>

        <canvas
          ref={canvasRef}
          width={960}
          height={640}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className="min-h-0 flex-1 w-full touch-none rounded-xl border border-zinc-300 bg-white shadow-inner"
        />
      </section>
    </main>
  );
}


