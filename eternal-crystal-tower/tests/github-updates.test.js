import test from "node:test";
import assert from "node:assert/strict";
import { fetchGithubCommits, GITHUB_COMMITS_URL, GITHUB_REPO, formatCommitUpdate } from "../src/github-updates.js";

test("GitHub 公告使用提交标题、上海时区日期和提交链接", () => {
  const entry = formatCommitUpdate({
    sha: "abcdef1234567890",
    html_url: "https://github.com/tcmiku/CrystalTower/commit/abcdef1234567890",
    commit: {
      message: "feat: 增加公告栏\n\n从 GitHub 提交日志读取更新。",
      author: { date: "2026-08-26T16:30:00Z" }
    }
  });

  assert.equal(GITHUB_REPO, "tcmiku/CrystalTower");
  assert.match(GITHUB_COMMITS_URL, /api\.github\.com\/repos\/tcmiku\/CrystalTower\/commits/);
  assert.equal(entry.version, "#abcdef1");
  assert.equal(entry.title, "增加公告栏");
  assert.equal(entry.text, "从 GitHub 提交日志读取更新。");
  assert.equal(entry.date, "2026.08.27");
  assert.equal(entry.url, "https://github.com/tcmiku/CrystalTower/commit/abcdef1234567890");
});

test("无效提交仍能生成安全的回退条目", () => {
  const entry = formatCommitUpdate({ commit: { message: "" } });
  assert.equal(entry.title, "未命名提交");
  assert.equal(entry.date, "日期未知");
  assert.equal(entry.url, "");
});
test("GitHub 提交加载器请求公开 commits 接口并映射列表", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  try {
    globalThis.fetch = async (url, options) => {
      requestedUrl = url;
      assert.equal(options.headers.Accept, "application/vnd.github+json");
      return {
        ok: true,
        async json() {
          return [{ sha: "123456789", html_url: "https://github.com/tcmiku/CrystalTower/commit/123456789", commit: { message: "fix: 修复公告日期", committer: { date: "2026-08-27T00:00:00Z" } } }];
        }
      };
    };
    const entries = await fetchGithubCommits();
    assert.equal(requestedUrl, GITHUB_COMMITS_URL);
    assert.equal(entries[0].title, "修复公告日期");
    assert.equal(entries[0].version, "#1234567");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
