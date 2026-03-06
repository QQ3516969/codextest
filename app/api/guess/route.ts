import { NextResponse } from "next/server";

type TaskMode = "general" | "handwriting";

type GuessRequest = {
  imageBase64?: string;
  model?: string;
  taskMode?: TaskMode;
};

type ZhipuTextPart = {
  type?: string;
  text?: string;
  content?: string;
};

type ZhipuResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<ZhipuTextPart | string>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function formatServerError(error: unknown) {
  if (!(error instanceof Error)) return "未知服务端错误。";

  const withCause = error as Error & {
    cause?: {
      code?: string;
    };
  };

  if (error.message === "fetch failed") {
    if (withCause.cause?.code === "UND_ERR_CONNECT_TIMEOUT") {
      return "服务端连接模型接口超时。请检查网络或代理设置。";
    }
    return "服务端请求模型接口失败，请检查网络连通性或代理设置。";
  }

  return error.message;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseZhipuText(content: string | Array<ZhipuTextPart | string> | undefined) {
  if (!content) return "";
  if (typeof content === "string") return content.trim();

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (typeof part.text === "string" && part.text.trim()) return part.text;
      if (typeof part.content === "string" && part.content.trim()) return part.content;
      return "";
    })
    .join("")
    .trim();
}

async function callZhipuOnce(imageBase64: string, model: string, apiKey: string, prompt: string) {
  const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 120,
    }),
  });

  const payload = (await response.json()) as ZhipuResponse;
  const errorMessage = payload.error?.message?.trim() ?? "";
  const rawText = parseZhipuText(payload.choices?.[0]?.message?.content).trim();
  return { response, errorMessage, rawText };
}

async function callZhipu(imageBase64: string, model: string, taskMode: TaskMode) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端缺少 ZHIPU_API_KEY。请在 .env.local 配置后重启。" },
      { status: 500 },
    );
  }

  const primaryPrompt =
    taskMode === "handwriting"
      ? "这是手写识别任务。请只输出一个答案：优先输出一个汉字或一个数字，不要解释。"
      : "你在玩你画我猜。请只返回一个最可能的中文答案（可能是物体、汉字或数字）。即使不确定也要给出最佳猜测，不要解释。";

  const fallbackPrompt =
    "把这张图当作手写识别任务。若像汉字就返回一个汉字；若像数字就返回一个数字；若都不像，返回一个最像的中文词。只输出答案本身。";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const firstPass = await callZhipuOnce(imageBase64, model, apiKey, primaryPrompt);
    const isBusy = firstPass.response.status === 429 || firstPass.response.status === 503;

    if (isBusy && attempt < 2) {
      await sleep(700 * (attempt + 1));
      continue;
    }

    if (!firstPass.response.ok) {
      return NextResponse.json(
        { error: firstPass.errorMessage || "智谱 API 请求失败。" },
        { status: firstPass.response.status },
      );
    }

    if (firstPass.rawText) {
      const guess = firstPass.rawText.replace(/\s+/g, " ").slice(0, 40);
      return NextResponse.json({ guess, rawText: firstPass.rawText, provider: "zhipu", model });
    }

    const secondPrompt = taskMode === "handwriting" ? primaryPrompt : fallbackPrompt;
    const secondPass = await callZhipuOnce(imageBase64, model, apiKey, secondPrompt);
    if (secondPass.rawText) {
      const guess = secondPass.rawText.replace(/\s+/g, " ").slice(0, 40);
      return NextResponse.json({ guess, rawText: secondPass.rawText, provider: "zhipu", model });
    }

    return NextResponse.json(
      {
        error:
          secondPass.errorMessage ||
          firstPass.errorMessage ||
          "你画的太抽象了吧，我竟然没认出来。",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ error: "智谱模型当前较忙，请稍后再试。" }, { status: 503 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GuessRequest;
    const imageBase64 = body.imageBase64?.trim();
    if (!imageBase64) {
      return NextResponse.json({ error: "缺少 imageBase64 参数。" }, { status: 400 });
    }

    const taskMode: TaskMode = body.taskMode === "handwriting" ? "handwriting" : "general";
    const model = body.model?.trim() || process.env.ZHIPU_MODEL || "glm-4.6v";
    return await callZhipu(imageBase64, model, taskMode);
  } catch (error) {
    return NextResponse.json({ error: formatServerError(error) }, { status: 500 });
  }
}
