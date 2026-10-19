import { useEffect, useMemo, useState } from "react";
import {
  ArrowsOutSimple,
  ArrowsClockwise,
  CaretDown,
  CheckCircle,
  ClipboardText,
  DownloadSimple,
  FileAudio,
  FileText,
  FolderSimple,
  GearSix,
  ImageSquare,
  LinkSimple,
  MagnifyingGlass,
  Play,
  Plus,
  Sparkle,
  SpinnerGap,
  StopCircle,
  TextAa,
  UploadSimple,
  VideoCamera,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

const backendBase = String(import.meta.env.VITE_BACKEND_BASE_URL || "").replace(
  /\/+$/,
  "",
);
const serviceUrl = (pathname) =>
  backendBase ? `${backendBase}${pathname}` : pathname;
const publicUrl = (pathname) => {
  if (!pathname || /^(?:https?:|data:|blob:)/i.test(pathname)) return pathname;
  return `${import.meta.env.BASE_URL}${String(pathname).replace(/^\/+/, "")}`;
};

const samples = [
  {
    id: "ai-workflow",
    title: "如何用 AI 提升个人效率？",
    excerpt: "分享我在工作中使用 AI 工具做资料整理、会议记录和写作的经验。",
    platform: "视频号",
    type: "视频",
    capturedAt: "今天 10:42",
    status: "未处理",
    image: "/assets/content/ai-productivity-talk.png",
    source: "https://channels.weixin.qq.com/live/example-ai-workflow",
    author: "科技小江",
    metrics: { likes: 8420, shares: 361, collects: 2170, comments: 189 },
  },
  {
    id: "travel",
    title: "一个人去大理的 7 天",
    excerpt: "把路上看见的湖泊、山路和独处的感受，整理成一条旅行路线。",
    platform: "抖音",
    type: "视频",
    capturedAt: "今天 09:18",
    status: "已生成逐字稿",
    image: "/assets/content/mountain-travel.png",
    source: "https://www.douyin.com/video/example-travel",
    author: "山野日记",
    metrics: { likes: 21600, shares: 1930, collects: 5110, comments: 602 },
  },
  {
    id: "product",
    title: "从 0 到 1 产品思维入门",
    excerpt: "一本值得反复阅读的产品书，怎样把知识真正用在项目里。",
    platform: "B站",
    type: "图文",
    capturedAt: "昨天 20:44",
    status: "已拆解",
    image: "/assets/content/notebook-study.png",
    source: "https://www.bilibili.com/video/example-product",
    author: "陈同学",
    metrics: { likes: 3800, shares: 150, collects: 990, comments: 83 },
  },
];
const platforms = {
  xhs: "小红书",
  dy: "抖音",
  ks: "快手",
  bili: "B站",
  wb: "微博",
  tieba: "贴吧",
  zhihu: "知乎",
};
const platformAliases = {
  ...platforms,
  douyin: "抖音",
  kuaishou: "快手",
  bilibili: "B站",
  weibo: "微博",
};
const ranges = {
  day: "近一天",
  week: "近一周",
  month: "近一个月",
  halfyear: "近半年",
  unlimited: "不限时间",
};
const contentStorageKey = "content-workbench-library-v2";
function loadStoredItems() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(contentStorageKey) || "null",
    );
    return Array.isArray(stored) && stored.length ? stored : samples;
  } catch {
    return samples;
  }
}
const assetId = (item) =>
  String(item?.resourceId || item?.id || item?.title || "content")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_")
    .slice(0, 96) || "content";
const mediaUrl = (item, file) =>
  serviceUrl(
    `/bridge/asset?path=${encodeURIComponent(`${assetId(item)}/${file}`)}`,
  );
const thumbnailUrl = (item) =>
  item.platform === "小红书" && /^https?:\/\//.test(item.image || "")
    ? publicUrl("/assets/content/notebook-study.png")
    : publicUrl(item.image);
const compact = (value) =>
  value >= 10000
    ? `${(value / 10000).toFixed(value > 99999 ? 0 : 1)}万`
    : new Intl.NumberFormat("zh-CN").format(value || 0);
const paragraphs = (text) =>
  String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
const statusClass = (status) =>
  status === "未处理"
    ? "pending"
    : status === "已生成逐字稿"
      ? "transcribed"
      : "analyzed";
const splitUrls = (value) =>
  Array.isArray(value)
    ? value.flatMap(splitUrls)
    : String(value || "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^https?:\/\//.test(value));
function metricValue(record, fields) {
  const raw = fields
    .map((field) => record[field])
    .find((value) => value !== undefined);
  const match = String(raw ?? 0)
    .replace(/,/g, "")
    .match(/[\d.]+/);
  return match ? Number(match[0]) * (/万|w/i.test(String(raw)) ? 10000 : 1) : 0;
}
function contentIdentity(item) {
  return [
    item.platform || "未知平台",
    item.resourceId ||
      item.source ||
      `${item.title || ""}|${item.author || ""}`,
  ].join("::");
}

function Metric({ name, field, value, sort, onSort, head = false }) {
  const active = sort.key === field;
  return (
    <button
      className={`metric ${active ? "metric-active" : ""} ${head ? "metric-head" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onSort(field);
      }}
    >
      <small>{name}</small>
      {!head && <b>{compact(value)}</b>}
      {active && (
        <CaretDown
          size={13}
          className={sort.direction === "asc" ? "caret-up" : ""}
        />
      )}
    </button>
  );
}
function Notice({ text, type, onClose }) {
  return text ? (
    <div className={`notice ${type}`}>
      <span>
        {type === "error" ? (
          <WarningCircle size={17} />
        ) : (
          <CheckCircle size={17} />
        )}
      </span>
      {text}
      <button onClick={onClose}>×</button>
    </div>
  ) : null;
}
function FullText({ data, onClose }) {
  return (
    <div className="modal-layer text-modal-layer">
      <section className="text-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <span className="eyebrow">完整内容</span>
        <h2>{data.title}</h2>
        <article>
          {paragraphs(data.text).map((part, index) => (
            <p key={index}>{part}</p>
          ))}
        </article>
      </section>
    </div>
  );
}
function ImageLightbox({ data, onClose }) {
  return (
    <div className="modal-layer image-lightbox" onClick={onClose}>
      <section onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="关闭大图">
          <X size={22} />
        </button>
        <img src={data.src} alt={data.title || "封面大图"} />
        <p>{data.title || "封面大图"}</p>
      </section>
    </div>
  );
}

export function App() {
  const [page, setPage] = useState("内容库");
  const [items, setItems] = useState(loadStoredItems);
  const [selected, setSelected] = useState(samples[0]);
  const [sort, setSort] = useState({ key: "likes", direction: "desc" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const [keywordFilter, setKeywordFilter] = useState("全部关键词");
  const [platformFilter, setPlatformFilter] = useState("全部平台");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [settings, setSettings] = useState(false);
  const [taskForm, setTaskForm] = useState(false);
  const [fullText, setFullText] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [crawler, setCrawler] = useState({ status: "checking" });
  const [logs, setLogs] = useState([]);
  const [bridge, setBridge] = useState({});
  const [assetState, setAssetState] = useState({});
  const [processing, setProcessing] = useState("");
  const [tab, setTab] = useState("逐字稿");
  const [prompt, setPrompt] = useState(
    "你是一位懂内容增长的编辑，保留事实、避免夸大，用自然流畅的中文表达。",
  );
  const [rewriteNeed, setRewriteNeed] = useState(
    "把逐字稿改写成结构清晰、可直接用于短视频口播的文案，保留核心观点，并分段呈现。",
  );
  const [cover, setCover] = useState({
    mode: "reference",
    prompt: "面向职场人群的 AI 效率方法，简洁、有冲击力的封面",
    style: "知识卡片，清爽绿白配色，标题层级清晰",
    ratio: "3:4",
    count: 1,
  });
  const [tasks, setTasks] = useState([]);

  const tell = (text, type = "success") => {
    setNotice(text);
    setNoticeType(type);
  };
  useEffect(() => {
    localStorage.setItem(contentStorageKey, JSON.stringify(items));
  }, [items]);
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try {
        const [a, b, c] = await Promise.all([
          fetch(serviceUrl("/api/crawler/status")),
          fetch(serviceUrl("/api/crawler/logs?limit=80")),
          fetch(serviceUrl("/bridge/status")),
        ]);
        if (!live) return;
        if (a.ok) setCrawler(await a.json());
        if (b.ok) setLogs((await b.json()).logs || []);
        if (c.ok) setBridge(await c.json());
      } catch {
        if (live) setCrawler({ status: "offline" });
      }
    };
    refresh();
    const interval = setInterval(refresh, 2500);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try {
        const id = assetId(selected);
        const [asset, transcript] = await Promise.all([
          fetch(
            serviceUrl(`/bridge/assets?record_id=${encodeURIComponent(id)}`),
          ),
          fetch(
            serviceUrl(`/bridge/asr/status?record_id=${encodeURIComponent(id)}`),
          ),
        ]);
        if (!live) return;
        setAssetState({
          ...(asset.ok ? await asset.json() : {}),
          transcription: transcript.ok ? await transcript.json() : null,
        });
      } catch {
        if (live) setAssetState({});
      }
    };
    refresh();
    return () => {
      live = false;
    };
  }, [selected, processing]);
  useEffect(() => {
    const task = tasks.find(
      (item) => !item.startRequested && !item.startFailed,
    );
    if (!task) return;
    setTasks((old) =>
      old.map((item) =>
        item.id === task.id ? { ...item, startRequested: true } : item,
      ),
    );
    const platform =
      Object.entries(platforms).find(
        ([, label]) => label === task.platform,
      )?.[0] || "xhs";
    fetch(serviceUrl("/api/crawler/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        crawler_type: "search",
        keywords: task.keywords,
        login_type: "qrcode",
        start_page: Number(task.startPage),
        max_notes_count: Number(task.maxNotesCount),
        enable_comments: task.comments,
        enable_sub_comments: task.comments && task.replies,
        enable_media: task.media,
        save_option: "jsonl",
      }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || "启动请求被拒绝");
        tell("采集任务已提交给原有 MediaCrawler，实时日志正在刷新。");
      })
      .catch((error) => {
        setTasks((old) =>
          old.map((item) =>
            item.id === task.id ? { ...item, startFailed: true } : item,
          ),
        );
        tell(`采集任务未启动：${error.message}`, "error");
      });
  }, [tasks]);
  const changeSort = (key) =>
    setSort((old) =>
      old.key === key
        ? { key, direction: old.direction === "desc" ? "asc" : "desc" }
        : { key, direction: "desc" },
    );
  const dedupedItems = useMemo(() => {
    const seen = new Set();
    const hasSyncedContent = items.some((item) => item.resourceId);
    const sourceItems = hasSyncedContent
      ? items.filter((item) => item.resourceId)
      : items;
    return sourceItems.filter((item) => {
      const identity = contentIdentity(item);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [items]);
  const visible = useMemo(
    () =>
      dedupedItems
        .filter(
          (item) =>
            (filter === "全部" || item.status === filter) &&
            (keywordFilter === "全部关键词" ||
              item.keyword === keywordFilter) &&
            (platformFilter === "全部平台" ||
              item.platform === platformFilter) &&
            (!query ||
              [item.title, item.author, item.platform, item.keyword]
                .join(" ")
                .toLowerCase()
                .includes(query.toLowerCase())),
        )
        .sort(
          (a, b) =>
            ((a.metrics?.[sort.key] || 0) - (b.metrics?.[sort.key] || 0)) *
            (sort.direction === "asc" ? 1 : -1),
        ),
    [dedupedItems, filter, keywordFilter, platformFilter, query, sort],
  );
  const keywordHistory = useMemo(
    () =>
      [
        ...new Set(dedupedItems.map((item) => item.keyword).filter(Boolean)),
      ].filter((keyword) => keyword !== "未标记"),
    [dedupedItems],
  );
  const platformOptions = useMemo(
    () => [...new Set(dedupedItems.map((item) => item.platform).filter(Boolean))],
    [dedupedItems],
  );
  const open = (item) => {
    setSelected(item);
    setTab("逐字稿");
    setPage("工作台");
  };
  const manifest = assetState.manifest;
  const assets = manifest?.assets || {};
  const transcript =
    assetState.transcription?.text || manifest?.transcription?.text || "";
  const rewrite = manifest?.rewrites?.[0]?.text || "";

  async function sync() {
    setProcessing("sync");
    try {
      const files =
        (await (await fetch(serviceUrl("/bridge/files"))).json()).files || [];
      const lists = await Promise.all(
        files
          .filter((file) => /contents/i.test(file.name))
          .map(async (file) => {
            const res = await fetch(
              serviceUrl(
                `/bridge/preview?path=${encodeURIComponent(file.path)}&limit=60`,
              ),
            );
            if (!res.ok) return [];
            const data = (await res.json()).data || [];
            const platformKey = String(file.path || "")
              .replaceAll("\\\\", "/")
              .split("/")[0]
              .toLowerCase();
            return data.map((record) => ({
              ...record,
              __sourcePlatform: platformKey,
            }));
          }),
      );
      const rows = lists.flat().map((record, index) => {
        const images = splitUrls(
            record.image_list ||
              record.images ||
              record.cover_url ||
              record.cover,
          ),
          videos = splitUrls(
            record.video_url ||
              record.video_urls ||
              record.video_download_url ||
              record.play_url,
          ),
          audio = splitUrls(record.music_download_url || record.audio_url);
        return {
          id: `sync-${record.__sourcePlatform || "unknown"}-${record.note_id || record.aweme_id || record.id || index}`,
          resourceId: String(
            record.note_id ||
              record.aweme_id ||
              record.video_id ||
              record.id ||
              index,
          ),
          title: String(
            record.title ||
              record.note_title ||
              record.desc ||
              record.content ||
              "未命名内容",
          ).slice(0, 80),
          excerpt: String(
            record.desc || record.content || "来自采集结果",
          ).slice(0, 110),
          platform:
            platformAliases[record.platform] ||
            platformAliases[record.__sourcePlatform] ||
            String(record.platform || record.__sourcePlatform || "未知平台"),
          keyword: String(
            record.source_keyword ||
              record.search_keyword ||
              record.keyword ||
              "未标记",
          ),
          type: String(
            record.type ||
              record.note_type ||
              (videos.length ? "视频" : "图文"),
          ),
          capturedAt: "刚刚同步",
          syncStatus: "已同步",
          status: "未处理",
          image: images[0] || "/assets/content/ai-productivity-talk.png",
          source: String(
            record.note_url ||
              record.aweme_url ||
              record.url ||
              record.link ||
              "",
          ),
          author: String(
            record.nickname || record.author || record.user_name || "原始作者",
          ),
          coverUrl: images[0] || "",
          imageUrls: images,
          videoUrls: videos,
          audioUrls: audio,
          metrics: {
            likes: metricValue(record, [
              "liked_count",
              "like_count",
              "likes",
              "digg_count",
            ]),
            shares: metricValue(record, [
              "share_count",
              "shared_count",
              "shares",
            ]),
            collects: metricValue(record, [
              "collected_count",
              "collect_count",
              "favorite_count",
              "fav_count",
            ]),
            comments: metricValue(record, [
              "comment_count",
              "comments_count",
              "comments",
            ]),
          },
        };
      });
      const uniqueRows = [
        ...new Map(rows.map((row) => [contentIdentity(row), row])).values(),
      ];
      const existingIdentities = new Set(dedupedItems.map(contentIdentity));
      const freshCount = uniqueRows.filter(
        (row) => !existingIdentities.has(contentIdentity(row)),
      ).length;
      setItems((old) => {
        const oldByIdentity = new Map(
          old.map((item) => [contentIdentity(item), item]),
        );
        const refreshed = uniqueRows.map((row) => ({
          ...row,
          status: oldByIdentity.get(contentIdentity(row))?.status || row.status,
        }));
        const refreshedIdentities = new Set(uniqueRows.map(contentIdentity));
        const untouched = old.filter(
          (item) => !refreshedIdentities.has(contentIdentity(item)),
        );
        const uniqueUntouched = [
          ...new Map(
            untouched.map((item) => [contentIdentity(item), item]),
          ).values(),
        ];
        return [...refreshed, ...uniqueUntouched];
      });
      const latestKeyword = uniqueRows.find(
        (row) => row.keyword && row.keyword !== "未标记",
      )?.keyword;
      if (latestKeyword) setKeywordFilter(latestKeyword);
      tell(`已同步 ${freshCount} 条新内容。平台、关键词和同步状态已更新。`);
    } catch {
      tell("同步失败，请检查采集服务与工作台连接。", "error");
    } finally {
      setProcessing("");
    }
  }
  async function download() {
    setProcessing("download");
    try {
      const res = await fetch(serviceUrl("/bridge/media/download"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: {
            id: assetId(selected),
            title: selected.title,
            source: selected.source,
            coverUrl: selected.coverUrl || selected.image,
            imageUrls: selected.imageUrls || [],
            videoUrls: selected.videoUrls || [],
            audioUrls: selected.audioUrls || [],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setAssetState((old) => ({ ...old, manifest: data.manifest }));
      const downloaded = [
        data.manifest?.assets?.cover && "封面",
        data.manifest?.assets?.video && "视频",
        data.manifest?.assets?.audio && "音频",
      ].filter(Boolean);
      tell(
        downloaded.length
          ? `${downloaded.join("、")}已下载并展示在左侧原始素材区。`
          : "未找到可下载的封面、视频或音频。",
        downloaded.length ? "success" : "error",
      );
    } catch (error) {
      tell(`资源下载失败：${error.message}`, "error");
    } finally {
      setProcessing("");
    }
  }
  async function stop() {
    try {
      const response = await fetch(serviceUrl("/api/crawler/stop"), {
        method: "POST",
      });
      if (!response.ok) throw new Error("请求未被接受");
      tell("已发送停止采集请求。 ");
    } catch (error) {
      tell(`停止失败：${error.message}`, "error");
    }
  }
  async function transcribe() {
    setProcessing("asr");
    try {
      const response = await fetch(serviceUrl("/bridge/asr/transcribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: assetId(selected) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      tell("豆包转写已提交，完成后将自动显示逐字稿。 ");
    } catch (error) {
      tell(error.message, "error");
    } finally {
      setProcessing("");
    }
  }
  async function doRewrite() {
    if (!transcript) return tell("请先完成音频转写。", "error");
    setProcessing("rewrite");
    try {
      const response = await fetch(serviceUrl("/bridge/rewrite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: assetId(selected),
          source_text: transcript,
          system_prompt: prompt,
          instruction: rewriteNeed,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setTab("改写文案");
      tell("AI 改写完成，已保存至当前专有工作台。 ");
    } catch (error) {
      tell(`改写失败：${error.message}`, "error");
    } finally {
      setProcessing("");
    }
  }
  async function createCover() {
    setProcessing("cover");
    try {
      const response = await fetch(serviceUrl("/bridge/cover/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: assetId(selected), ...cover }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      tell("生成的封面已保存为该条内容的新资产。 ");
    } catch (error) {
      tell(`封面生成失败：${error.message}`, "error");
    } finally {
      setProcessing("");
    }
  }
  const nav = [
    ["内容库", FolderSimple],
    ["采集任务", ClipboardText],
    ["素材", ImageSquare],
    ["发布", UploadSimple],
  ];
  if (page === "工作台")
    return (
      <Workbench
        {...{
          selected,
          setPage,
          assets,
          manifest,
          transcript,
          rewrite,
          tab,
          setTab,
          bridge,
          processing,
          download,
          transcribe,
          doRewrite,
          createCover,
          cover,
          setCover,
          prompt,
          setPrompt,
          rewriteNeed,
          setRewriteNeed,
          notice,
          noticeType,
          setNotice,
          settings,
          setSettings,
          fullText,
          setFullText,
          previewImage,
          setPreviewImage,
        }}
      />
    );
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>C</span>内容工作台
        </div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <Icon size={20} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            <i />
            采集引擎独立运行
          </span>
          <button onClick={() => setSettings(true)}>
            <GearSix size={17} />
            设置
          </button>
        </div>
      </aside>
      <section className="content-pane">
        <header className="topbar">
          <div>
            <span className="eyebrow">CONTENT OS</span>
            <h1>{page}</h1>
            <p>
              {page === "内容库"
                ? "把每次采集的内容沉淀为可编排、可复用的资产。"
                : page === "采集任务"
                  ? "采集执行仍由原有 MediaCrawler 负责，工作台只展示和发起请求。"
                  : "从资产开始，整理新的内容生产流程。"}
            </p>
          </div>
          <div className="top-actions">
            {page === "内容库" && (
              <>
                <label className="search">
                  <MagnifyingGlass size={18} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索标题、作者或平台"
                  />
                </label>
                <button
                  className="light-button"
                  onClick={() => setTaskForm(true)}
                >
                  <Plus size={17} />
                  新建采集任务
                </button>
                <button
                  className="dark-button"
                  onClick={sync}
                  disabled={processing === "sync"}
                >
                  {processing === "sync" ? (
                    <SpinnerGap className="spin" />
                  ) : (
                    <ArrowsClockwise size={17} />
                  )}
                  同步内容库
                </button>
              </>
            )}
            {page === "采集任务" && (
              <button className="dark-button" onClick={() => setTaskForm(true)}>
                <Plus size={17} />
                新建采集任务
              </button>
            )}
          </div>
        </header>
        <Notice text={notice} type={noticeType} onClose={() => setNotice("")} />
        {page === "内容库" && (
          <Library
            items={visible}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            changeSort={changeSort}
            open={open}
            keywordHistory={keywordHistory}
            keywordFilter={keywordFilter}
            setKeywordFilter={setKeywordFilter}
            platformOptions={platformOptions}
            platformFilter={platformFilter}
            setPlatformFilter={setPlatformFilter}
          />
        )}
        {page === "采集任务" && (
          <Tasks
            crawler={crawler}
            logs={logs}
            tasks={tasks}
            stop={stop}
            make={() => setTaskForm(true)}
          />
        )}
        {page === "素材" && <Assets items={dedupedItems} open={open} />}
        {page === "发布" && (
          <section className="asset-overview">
            <h2>发布准备</h2>
            <p>先完成转写与改写，再进入发布前的资产整理。</p>
            <div className="empty-document">
              发布能力预留在现有工作台外，不影响 MediaCrawler 原有能力。
            </div>
          </section>
        )}
      </section>
      {taskForm && (
        <TaskForm
          onClose={() => setTaskForm(false)}
          onSubmit={(task) => {
            setTasks((old) => [{ id: Date.now(), ...task }, ...old]);
            setTaskForm(false);
            setPage("采集任务");
            tell("采集任务表单已创建；提交时将使用原有采集接口。 ");
          }}
        />
      )}
      {settings && (
        <Settings bridge={bridge} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}

function Library({
  items,
  filter,
  setFilter,
  sort,
  changeSort,
  open,
  keywordHistory,
  keywordFilter,
  setKeywordFilter,
  platformOptions,
  platformFilter,
  setPlatformFilter,
}) {
  const fields = [
    ["点赞", "likes"],
    ["分享", "shares"],
    ["收藏", "collects"],
    ["评论", "comments"],
  ];
  return (
    <>
      <section className="keyword-filter-bar" aria-label="采集关键词筛选">
        <span className="filter-label">采集关键词</span>
        <div className="keyword-tags">
          {["全部关键词", ...keywordHistory].map((keyword) => (
            <button
              key={keyword}
              className={keywordFilter === keyword ? "active" : ""}
              onClick={() => setKeywordFilter(keyword)}
            >
              {keyword}
            </button>
          ))}
        </div>
      </section>
      <div className="library-toolbar">
        <div className="library-filter-groups">
          <label className="platform-filter-control">
            <span className="filter-label">平台</span>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              aria-label="选择内容平台"
            >
              <option value="全部平台">全部平台</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>
          <div className="status-filter-group">
            <span className="filter-label">处理状态</span>
            <div className="filters">
              {["全部", "未处理", "已生成逐字稿", "已拆解"].map((name) => (
                <button
                  key={name}
                  className={filter === name ? "active" : ""}
                  onClick={() => setFilter(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <span>
          当前关键词：{keywordFilter} · {platformFilter} · {items.length} 条内容 ·
          点击数据字段排序
        </span>
      </div>
      <section className="content-table">
        <div className="table-head">
          <span>内容</span>
          <span>平台</span>
          {fields.map(([name, field]) => (
            <Metric
              key={field}
              name={name}
              field={field}
              sort={sort}
              onSort={changeSort}
              head
            />
          ))}
          <span>同步</span>
          <span>处理状态</span>
        </div>
        {items.map((item) => (
          <div
            className="content-row"
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => open(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") open(item);
            }}
          >
            <span className="content-info">
              <img src={thumbnailUrl(item)} alt="" />
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.author} · {item.type} · {item.capturedAt}
                </small>
                <em>{item.excerpt}</em>
              </span>
            </span>
            <span className="platform-pill">{item.platform}</span>
            {fields.map(([name, field]) => (
              <Metric
                key={field}
                name={name}
                field={field}
                value={item.metrics?.[field]}
                sort={sort}
                onSort={changeSort}
              />
            ))}
            <span className="sync-badge">{item.syncStatus || "未同步"}</span>
            <span className={`status ${statusClass(item.status)}`}>
              <i />
              {item.status}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
function Tasks({ crawler, logs, tasks, stop, make }) {
  const running = crawler.status === "running" || crawler.status === "stopping";
  return (
    <section className="task-board">
      <div className="monitor">
        <div>
          <span className="eyebrow">采集实时状态</span>
          <h2>
            {running
              ? crawler.status === "stopping"
                ? "正在停止"
                : "正在采集"
              : crawler.status === "offline"
                ? "引擎未连接"
                : "等待采集任务"}
          </h2>
          <p>
            实时日志每 2.5 秒刷新。停止采集不会修改 MediaCrawler 代码或配置。
          </p>
        </div>
        {running ? (
          <button className="stop-button" onClick={stop}>
            <StopCircle size={18} />
            停止采集
          </button>
        ) : (
          <button className="light-button" onClick={make}>
            <Play size={17} />
            开始采集
          </button>
        )}
      </div>
      <div className="log-window">
        {logs.length ? (
          logs.slice(-32).map((log, index) => (
            <div key={`${index}-${log.timestamp}`}>
              <time>{log.timestamp}</time>
              <span>{log.message}</span>
            </div>
          ))
        ) : (
          <span>等待采集引擎输出日志…</span>
        )}
      </div>
      <div className="task-list">
        <h3>本次会保留的采集选项</h3>
        {tasks.length ? (
          tasks.map((task) => (
            <div className="task-item" key={task.id}>
              <strong>{task.keywords}采集</strong>
              <span>
                {task.platform} · 第 {task.startPage} 页起 · 最多{" "}
                {task.maxNotesCount} 条 · {task.range}
              </span>
              <em>{task.comments ? "采集评论" : "不采集评论"}</em>
            </div>
          ))
        ) : (
          <div className="empty-document">暂未新建采集任务。</div>
        )}
      </div>
    </section>
  );
}
function Assets({ items, open }) {
  return (
    <section className="asset-overview">
      <h2>素材资产库</h2>
      <p>进入单条内容的工作台，即可查看和下载封面、视频、音频与新生成资产。</p>
      <div>
        {items.map((item) => (
          <button key={item.id} onClick={() => open(item)}>
            <img src={thumbnailUrl(item)} alt="" />
            <span>
              <strong>{item.title}</strong>
              <small>进入专有工作台</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
function TaskForm({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    platform: "小红书",
    keywords: "AI 效率",
    startPage: 1,
    maxNotesCount: 20,
    range: "不限时间",
    comments: true,
    replies: false,
    media: true,
  });
  return (
    <div className="modal-layer">
      <form
        className="task-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          <X size={20} />
        </button>
        <span className="eyebrow">COLLECTION</span>
        <h2>新建采集任务</h2>
        <p>时间范围只用于工作台同步筛选；不会改变原采集器的逻辑。</p>
        <div className="form-grid">
          <label>
            采集平台
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
            >
              {Object.values(platforms).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            采集方式
            <select>
              <option>关键词搜索</option>
              <option>指定内容链接</option>
              <option>创作者主页</option>
            </select>
          </label>
          <label>
            从第几页开始
            <input
              type="number"
              min="1"
              value={form.startPage}
              onChange={(e) => setForm({ ...form, startPage: e.target.value })}
            />
          </label>
          <label>
            最多采集多少条
            <input
              type="number"
              min="1"
              value={form.maxNotesCount}
              onChange={(e) =>
                setForm({ ...form, maxNotesCount: e.target.value })
              }
            />
          </label>
        </div>
        <label>
          内容发布时间范围
          <select
            value={form.range}
            onChange={(e) => setForm({ ...form, range: e.target.value })}
          >
            {Object.values(ranges).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          关键词或链接
          <input
            required
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>附加采集选项</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.checked })}
            />
            采集一级评论
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.replies}
              disabled={!form.comments}
              onChange={(e) => setForm({ ...form, replies: e.target.checked })}
            />
            同时采集评论回复
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.media}
              onChange={(e) => setForm({ ...form, media: e.target.checked })}
            />
            下载封面、视频及媒体
          </label>
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="light-button" onClick={onClose}>
            取消
          </button>
          <button className="dark-button">
            <Play size={17} />
            开始采集
          </button>
        </div>
      </form>
    </div>
  );
}
function Settings({ bridge, onClose }) {
  return (
    <div className="modal-layer">
      <section className="settings-modal">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <span className="eyebrow">本机连接</span>
        <h2>工作台服务状态</h2>
        {[
          ["媒体下载与音频提取", bridge.ffmpeg_ready ? "已就绪" : "未检测到"],
          [
            "豆包录音文件识别 2.0",
            bridge.doubao?.has_api_key
              ? bridge.doubao?.ready
                ? "已就绪"
                : "已配置密钥，等待公网音频地址"
              : "未配置",
          ],
          [
            "DeepSeek 文案改写",
            bridge.ai?.deepseek?.ready ? "已就绪" : "未配置",
          ],
          [
            "CogView-3-Flash 封面生成",
            bridge.ai?.image?.ready ? "已就绪" : "未配置",
          ],
        ].map(([name, value]) => (
          <div key={name}>
            <b>{name}</b>
            <span>{value}</span>
          </div>
        ))}
        <p>
          密钥仅保存在本机服务启动环境，不会发送到浏览器，也不会写入采集结果。
        </p>
        <button className="dark-button" onClick={onClose}>
          知道了
        </button>
      </section>
    </div>
  );
}
function Workbench(props) {
  const {
    selected,
    setPage,
    assets,
    manifest,
    transcript,
    rewrite,
    tab,
    setTab,
    bridge,
    processing,
    download,
    transcribe,
    doRewrite,
    createCover,
    cover,
    setCover,
    prompt,
    setPrompt,
    rewriteNeed,
    setRewriteNeed,
    notice,
    noticeType,
    setNotice,
    settings,
    setSettings,
    fullText,
    setFullText,
    previewImage,
    setPreviewImage,
  } = props;
  const fieldData = [
    ["点赞", "likes"],
    ["分享", "shares"],
    ["收藏", "collects"],
    ["评论", "comments"],
  ];
  return (
    <main className="workbench-shell">
      <aside className="rail">
        <div className="rail-mark">C</div>
        <button title="内容库" onClick={() => setPage("内容库")}>
          <FolderSimple size={21} />
        </button>
        <button title="采集任务" onClick={() => setPage("采集任务")}>
          <ClipboardText size={21} />
        </button>
        <button
          className="rail-bottom"
          title="设置"
          onClick={() => setSettings(true)}
        >
          <GearSix size={21} />
        </button>
      </aside>
      <aside className="source-inspector">
        <button className="back-link" onClick={() => setPage("内容库")}>
          ← 返回内容库
        </button>
        <div className="inspector-head">
          <span>原始素材</span>
          <button onClick={download} disabled={!!processing}>
            <DownloadSimple size={16} />
            {processing === "download" ? "下载中" : "下载"}
          </button>
        </div>
        <h2>{selected.title}</h2>
        <p>
          {selected.platform} · {selected.author}
        </p>
        <div className="source-tabs">
          <span className="selected">资产</span>
          <span>数据</span>
        </div>
        <div className="source-assets">
          {assets.cover?.file ? (
            <figure>
              <button
                type="button"
                className="asset-image-button"
                onClick={() =>
                  setPreviewImage({
                    src: mediaUrl(selected, assets.cover.file),
                    title: "原始封面",
                  })
                }
                aria-label="查看原始封面大图"
              >
                <img
                  src={mediaUrl(selected, assets.cover.file)}
                  alt="原始封面"
                />
                <span>
                  <ArrowsOutSimple size={15} /> 查看大图
                </span>
              </button>
              <figcaption>原始封面 · 点击可查看完整图片</figcaption>
            </figure>
          ) : (
            <div className="asset-placeholder">
              <ImageSquare size={28} />
              <span>尚未下载封面</span>
            </div>
          )}
          {assets.video?.file ? (
            <figure>
              <video
                controls
                poster={
                  assets.cover?.file
                    ? mediaUrl(selected, assets.cover.file)
                    : undefined
                }
                src={mediaUrl(selected, assets.video.file)}
              />
              <figcaption>原始视频</figcaption>
            </figure>
          ) : (
            <div className="asset-placeholder">
              <VideoCamera size={28} />
              <span>尚未下载视频</span>
            </div>
          )}
          {assets.audio?.file ? (
            <figure>
              <audio controls src={mediaUrl(selected, assets.audio.file)} />
              <figcaption>提取音频</figcaption>
            </figure>
          ) : (
            <div className="asset-placeholder">
              <FileAudio size={28} />
              <span>下载视频后可提取音频</span>
            </div>
          )}
        </div>
        <a
          className="source-url"
          href={selected.source}
          target="_blank"
          rel="noreferrer"
        >
          <LinkSimple size={16} />
          查看原始链接
        </a>
      </aside>
      <section className="workspace-canvas">
        <header className="workspace-top">
          <div>
            <span className="eyebrow">专有工作台</span>
            <h1>{selected.title}</h1>
            <p>原始资产固定在左侧；在此编排逐字稿、改写文案与新封面。</p>
          </div>
          <span className="workspace-status">
            <i />
            {selected.status}
          </span>
        </header>
        <Notice text={notice} type={noticeType} onClose={() => setNotice("")} />
        <div className="workspace-tabs">
          {["逐字稿", "改写文案", "内容数据"].map((name) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {tab === "逐字稿" && (
          <>
            <section className="action-banner">
              <div>
                <b>豆包语音转文字</b>
                <small>
                  使用录音文件识别 2.0。音频文件会在当前工作台保留。
                </small>
              </div>
              <button
                className="dark-button"
                disabled={!!processing || !assets.audio?.file}
                onClick={transcribe}
              >
                {processing === "asr" ? (
                  <SpinnerGap className="spin" />
                ) : (
                  <FileText size={17} />
                )}
                {bridge.doubao?.ready ? "开始转写" : "转写配置待完成"}
              </button>
            </section>
            <Document
              title="逐字稿"
              text={transcript}
              open={() => setFullText({ title: "逐字稿", text: transcript })}
            />
          </>
        )}
        {tab === "改写文案" && (
          <>
            <section className="rewrite-panel">
              <div className="card-title">
                <span>
                  <TextAa size={18} />
                  AI 文案改写
                </span>
                <span className="api-tag">DeepSeek</span>
              </div>
              <label>
                系统人设 / 提示词
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
              <label>
                改写要求
                <textarea
                  value={rewriteNeed}
                  onChange={(e) => setRewriteNeed(e.target.value)}
                />
              </label>
              <button
                className="dark-button"
                disabled={!!processing || !transcript}
                onClick={doRewrite}
              >
                {processing === "rewrite" ? (
                  <SpinnerGap className="spin" />
                ) : (
                  <Sparkle size={17} />
                )}
                {processing === "rewrite" ? "生成中" : "生成改写文案"}
              </button>
            </section>
            <Document
              title="最新改写版本"
              text={rewrite}
              open={() => setFullText({ title: "AI 改写文案", text: rewrite })}
            />
          </>
        )}
        {tab === "内容数据" && (
          <section className="data-card">
            <h3>采集的核心数据</h3>
            <div className="data-grid">
              {fieldData.map(([name, key]) => (
                <div key={key}>
                  <small>{name}</small>
                  <b>{compact(selected.metrics?.[key])}</b>
                </div>
              ))}
            </div>
            <p>数据源于每次同步的采集结果，未修改原始采集数据。</p>
          </section>
        )}
      </section>
      <CoverStudio
        {...{
          cover,
          setCover,
          createCover,
          processing,
          assets,
          manifest,
          selected,
          setPreviewImage,
        }}
      />
      {fullText && (
        <FullText data={fullText} onClose={() => setFullText(null)} />
      )}
      {previewImage && (
        <ImageLightbox
          data={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
      {settings && (
        <Settings bridge={bridge} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}
function Document({ title, text, open }) {
  return (
    <section className="document-card">
      <div className="card-title">
        <span>
          <FileText size={18} />
          {title}
        </span>
        {text && <button onClick={open}>查看全文</button>}
      </div>
      {text ? (
        <div className="document-preview">
          {paragraphs(text)
            .slice(0, 3)
            .map((part, index) => (
              <p key={index}>{part}</p>
            ))}
        </div>
      ) : (
        <div className="empty-document">
          尚无内容，完成操作后会保存到这一条内容的工作台。
        </div>
      )}
    </section>
  );
}
function CoverStudio({
  cover,
  setCover,
  createCover,
  processing,
  assets,
  manifest,
  selected,
  setPreviewImage,
}) {
  return (
    <aside className="cover-studio">
      <div className="cover-studio-head">
        <span>封面实验室</span>
        <Sparkle size={18} />
      </div>
      <h2>生成新封面</h2>
      <div className="mode-tabs">
        <button
          className={cover.mode === "text" ? "selected" : ""}
          onClick={() => setCover({ ...cover, mode: "text" })}
        >
          文生图
        </button>
        <button
          className={cover.mode === "reference" ? "selected" : ""}
          onClick={() => setCover({ ...cover, mode: "reference" })}
        >
          参考原封面
        </button>
      </div>
      {cover.mode === "reference" && (
        <div className="reference-note">
          <ImageSquare size={18} />
          <span>
            <b>当前参考资源</b>
            <small>
              将提取原封面的构图、色彩与风格，不复制文字、Logo 或人物。
            </small>
          </span>
        </div>
      )}
      <label>
        封面提示词
        <textarea
          value={cover.prompt}
          onChange={(e) => setCover({ ...cover, prompt: e.target.value })}
        />
      </label>
      <label>
        风格补充（可选）
        <textarea
          value={cover.style}
          onChange={(e) => setCover({ ...cover, style: e.target.value })}
        />
      </label>
      <div className="cover-selects">
        <label>
          画面比例
          <select
            value={cover.ratio}
            onChange={(e) => setCover({ ...cover, ratio: e.target.value })}
          >
            {["9:16", "16:9", "3:4", "4:3", "1:1"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          候选数量
          <select
            value={cover.count}
            onChange={(e) =>
              setCover({ ...cover, count: Number(e.target.value) })
            }
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value}>{value} 张</option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="cover-button"
        disabled={
          !!processing || (cover.mode === "reference" && !assets.cover?.file)
        }
        onClick={createCover}
      >
        {processing === "cover" ? (
          <SpinnerGap className="spin" />
        ) : (
          <Sparkle size={17} />
        )}
        {processing === "cover" ? "生成中" : "生成封面"}
      </button>
      <small className="cover-help">
        使用 CogView-3-Flash。生成图会与原资产分开保存。
      </small>
      <div className="generated-list">
        {manifest?.generated_covers
          ?.flatMap((task) => task.images || [])
          .slice(0, 4)
          .map((image) => (
            <button
              key={image.file}
              type="button"
              onClick={() =>
                setPreviewImage({
                  src: mediaUrl(selected, image.file),
                  title: "生成的封面",
                })
              }
              aria-label="查看生成封面大图"
            >
              <img src={mediaUrl(selected, image.file)} alt="生成的封面" />
            </button>
          ))}
      </div>
    </aside>
  );
}
