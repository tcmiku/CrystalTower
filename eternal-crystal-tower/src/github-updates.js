const OWNER = "tcmiku";
const REPOSITORY = "CrystalTower";

export const GITHUB_REPO = `${OWNER}/${REPOSITORY}`;
export const GITHUB_COMMITS_URL = `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=8`;

const COMMIT_PREFIX_RE = /^(feat|fix|refactor|perf|docs|chore|test|build|ci)(\([^)]*\))?:\s*/i;

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(date).replaceAll("/", ".");
}

function normalizeMessage(message) {
  const lines = String(message || "未命名提交")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = (lines.shift() || "未命名提交").replace(COMMIT_PREFIX_RE, "");
  return { title, text: lines.join(" ") || "GitHub 提交日志" };
}

export function formatCommitUpdate(commit) {
  if (!commit || typeof commit !== "object") return null;
  const sha = typeof commit.sha === "string" ? commit.sha : "";
  const commitData = commit.commit && typeof commit.commit === "object" ? commit.commit : {};
  const message = normalizeMessage(commitData.message);
  const dateValue = commitData.author?.date || commitData.committer?.date;
  const url = typeof commit.html_url === "string" ? commit.html_url : "";
  return {
    version: sha ? `#${sha.slice(0, 7)}` : "GitHub",
    date: normalizeDate(dateValue),
    title: message.title,
    text: message.text,
    tag: "GitHub 提交",
    url
  };
}

export async function fetchGithubCommits({ signal } = {}) {
  const response = await fetch(GITHUB_COMMITS_URL, {
    headers: { Accept: "application/vnd.github+json" },
    signal
  });
  if (!response.ok) throw new Error(`GitHub commits request failed: ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("GitHub commits response was not an array");
  return payload.map(formatCommitUpdate).filter(Boolean);
}

